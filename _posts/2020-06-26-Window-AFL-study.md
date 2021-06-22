---
layout: post
title: Windows American Fuzzy Lop for b4sh5i
tags: [Window, Fuzzing]
---

Windows 에서 AFL 을 사용 하는 방법을 써보긴 해야되서, 그냥 개인 공부겸 퍼징으로 연구할 겸 만든 문서. 

## So how to install
1. cmake
2. AFL
3. DynamoRio
4. Visual Studio

일단 2013 이상의 visual studio 사용 하라고 권장. 아직 작성은 안했는데 쭉 일지 작성할꺼라서 문제 생기면 날짜 별로 아래에 작성할 계획.

먼저 가장 중요한 winafl [링크](https://github.com/ivanfratric/winafl) 이다. 가서 이것 저것 확인 하면 될꺼 같다. [github ling](https://github.com/googleprojectzero/winafl)

1. Cmake install
Cmake 는 [여기](https://cmake.org/download/) 여기서 받고. 검색 기록에선 3.12.1 윈도우 64bit 버전 사용하였음.

2. AFL install 
이거도 좀 신기한거 같은데 fork 로 따로 떠서 링크를 보냈는데. 원문 링크 안되면 이거로 해보면 될꺼 같다. [LINK](https://github.com/googleprojectzero/winafl) , [Fork LINK](https://github.com/ivanfratric/winafl)

3. DynamoRio
Pin 과 함께 많이 사용되는 DBI 툴이다. [LINK](https://github.com/DynamoRIO/dynamorio/wiki/Downloads)

![](https://img1.daumcdn.net/thumb/R1280x0/?scode=mtistory2&fname=https%3A%2F%2Fk.kakaocdn.net%2Fdn%2FcGikBY%2FbtqBPXNFyHE%2F6eQO6fKypXQX3teGX2xK6k%2Fimg.png)

4. Visual Studio Install
일단 이거 버전때문에 이슈가 가장 많은데 2019 ? 2017 ? 이것만 좀 생각하고 둘 중 하나만 사용하면 될꺼 같다.

## Go Build

![](https://img1.daumcdn.net/thumb/R1280x0/?scode=mtistory2&fname=https%3A%2F%2Fk.kakaocdn.net%2Fdn%2FdmAR25%2FbtqBPYZ6DV3%2FGiko5zmI4od5kdYcS0kyY1%2Fimg.png)

일단 각자 본인 os 비트에 맞게 prompt 사용한다. 예시에선 `VS2012 x64 Cross Tools Command Prompt` 를 사용하였음.

![](https://img1.daumcdn.net/thumb/R1280x0/?scode=mtistory2&fname=https%3A%2F%2Fk.kakaocdn.net%2Fdn%2FnUOyM%2FbtqBNMfkcsB%2FJ05r5lk5tKTLN78JBolGWK%2Fimg.png)

Prompt 를 열고 build64 폴더를 하나 생성하고 거기로 이동.

![](https://img1.daumcdn.net/thumb/R1280x0/?scode=mtistory2&fname=https%3A%2F%2Fk.kakaocdn.net%2Fdn%2Flh0de%2FbtqBQ1aZwxT%2F9ERKoZJKIzstW8Ve1YvC40%2Fimg.png)

cmake --help로 설치된 Visual Studio에 맞는 Generator 명을 확인한다. 여기서 당연히 위에서 설치한 cmake가 시스템 변수에 등록되어있어야 한다. (혹은 귀찮다면 cmake가 설치된 경로로 가서 확인해도 무방)

```bash
cmake -G"[Generateor]" .. -DDynamoRIO_DIR="[path to DynamoRIO cmake]"
```

확인한 Generator 명에 맞추어 아래 명령을 수행한다. 여기서도 좀 삽질을 했는데 -DDynamoRIO_DIR에 넘겨주는 경로값은 DynamoRIO 경로가 아닌 'DynamoRIO 안의 cmake 폴더 경로'이다.

![](https://img1.daumcdn.net/thumb/R1280x0/?scode=mtistory2&fname=https%3A%2F%2Fk.kakaocdn.net%2Fdn%2FqQw8u%2FbtqBPXUsl9A%2FCoW1R5mUw53kEXsSsyxfw0%2Fimg.png)

```bash
cmake -G"Visual Studio 12 Win64" .. -DDynamoRIO_DIR="C:\Users\leefo\Desktop\program\DynamoRIO-Windows-7.0.0-RC1\DynamoRIO-Windows-7.0.0-RC1\cmake"
```
DynamoRIO 압축을 푼 폴더에 들어가면 위와 같이 cmake 폴더가 있을 것이다. 그리고 위의 명령어를 입력.

![](https://img1.daumcdn.net/thumb/R1280x0/?scode=mtistory2&fname=https%3A%2F%2Fk.kakaocdn.net%2Fdn%2FxiWsf%2FbtqBOCQMZCQ%2FQeGPJDh1nmANKrrqdbOjt0%2Fimg.png)

위의 캡쳐가 정상적으로 해당 명령어가 실행된 결과이다. 

![](https://img1.daumcdn.net/thumb/R1280x0/?scode=mtistory2&fname=https%3A%2F%2Fk.kakaocdn.net%2Fdn%2FcaTS0o%2FbtqBPYsg6NK%2FLPhrGsyupErQX8Jqp9EmM1%2Fimg.png)

Configuring done, Generating done 이 출력되야 한다.

![](https://img1.daumcdn.net/thumb/R1280x0/?scode=mtistory2&fname=https%3A%2F%2Fk.kakaocdn.net%2Fdn%2FsJcvZ%2FbtqBOCJZwlB%2Feo2cA732waYzHuaI8Jp4LK%2Fimg.png)

```bash
cmake --build . --config Release
```
Configuring done, Generating done 이 출력되야 한다.

![](https://img1.daumcdn.net/thumb/R1280x0/?scode=mtistory2&fname=https%3A%2F%2Fk.kakaocdn.net%2Fdn%2FkGGuW%2FbtqBQ2AXttA%2FIK2tKKoFCynOvoFiFhuQHk%2Fimg.png)

완성 ~

## Using WinAFL to fuzz Hangul HWP AppShield

In HncAppShield case, it is a DLL so I created a simple loader to load the DLL and call `AppShield_InspectMalware()` with fuzzing input. `AppShield_InpectMalware()` is an exported function which receives file path as an argument. I chose this function to fuzz with WinAFL at first.

```C++
#include <stdio.h>
#include <Windows.h>
#include <iostream>

extern "C" __declspec(dllexport) int fuzz_hwp(wchar_t* hwp);

typedef int(*INSPECT)(wchar_t* filename);

INSPECT AppShield_InspectMalware;

wchar_t* charToWChar(const char* text) {
    size_t size = strlen(text) + 1;
    wchar_t* wa = (wchar_t*)malloc(sizeof(wchar_t) * size);
    mbstowcs(wa, text, size);
    return wa;
}

int fuzz_hwp(wchar_t* filename) {
    AppShield_InspectMalware(filename);
    return 0;
}

int main(int argc, char** argv) {
    HINSTANCE HncAppShield = LoadLibrary(L"HncAppShield.dll");
    int isDetected = 0;
    if (HncAppShield) {
        AppShield_InspectMalware = (INSPECT)GetProcAddress(HncAppShield, (LPCSTR)1);
        isDetected = fuzz_hwp(charToWChar(argv[1]));
    }
    printf("[Malware result] %d\n", isDetected);
    return isDetected;
}
```

I compiled the loader(HncAppShieldLoader.exe) and started fuzzing with WinAFL using the following command.

```bash
afl-fuzz.exe -i in -o out -D D:\DynamoRIO\bin32 -t 10000 -- -coverage_module AppShieldDLL.dll -fuzz_iterations 5000 -target_module HncAppShieldLoader.exe -target_method fuzz_hwp -nargs 1 -- .\HncAppShieldLoader.exe @@
```

WinAFL was working, with about 20 ~ 30 executions per second on my desktop right after the start.

Richard gave some comments that this might be due to files or some other resources not properly released and that I must hook more deep into the module to avoid this issue. So I started analyzing what happens after calling AppInspect_Malware() to see if there are other places in the module that can be fuzzed.

```C++
#include <stdio.h>
#include <Windows.h>

extern "C" __declspec(dllexport) int fuzz_hwp(wchar_t* hwp);

// Function Pointers Definition

typedef int(*OPENSTORAGE)(wchar_t*);

typedef BOOL(*HWP_FILE_CHECK1)(wchar_t*);

typedef int(*HWP_FILE_CHECK2)(wchar_t*);

typedef int(*HWP_DUMP)(wchar_t*, int*);

typedef int(*HWP_DUMP_WORKBOOK)(wchar_t*, int, int*);

typedef int(*SCAN_DIRECTORY)();

typedef int(*DELETE_TEMP_FOLDER)();


HWP_FILE_CHECK1 hwp_file_check1;

HWP_FILE_CHECK2 hwp_file_check2;

HWP_DUMP hwp_dump;

HWP_DUMP_WORKBOOK hwp_dump_workbook;

OPENSTORAGE open_storage;

SCAN_DIRECTORY scan_directory;

DELETE_TEMP_FOLDER delete_temp_folder;

wchar_t* output;
wchar_t* input;

wchar_t* get_filename(wchar_t* name) {
    wchar_t fname[40];
    wchar_t ext[10];
    wchar_t* res = NULL;

    _wsplitpath(name, NULL, NULL, fname, ext);

    res = (wchar_t*)malloc((wcslen(fname) + wcslen(ext) + 1) * sizeof(wchar_t));
    wcscpy(res, fname);
    wcscat(res, ext);
    return res;
}

int filter_exception(int code, PEXCEPTION_POINTERS ex) {
   	printf("Filtering %x\n", code);
    return EXCEPTION_EXECUTE_HANDLER;
}

wchar_t* charToWChar(const char* text) {
    size_t size = strlen(text) + 1;
    wchar_t* wa = (wchar_t*)malloc(sizeof(wchar_t) * size);
    mbstowcs(wa, text, size);
    return wa;
}

int dump_storage(wchar_t* filename) {
    int flag = 0;
    wchar_t destname[MAX_PATH];
    wchar_t* destname_p;
    wchar_t* n;
    wchar_t* filep;

    wcscpy(destname, output);
    wcscat(destname, L"\\");

    n = get_filename(filename);

    wcscat(destname, n);

    free(n);

    destname_p = destname;

    printf("[+] Target file : %ls\n", filename);
    printf("[+] Destination : %ls\n", destname_p);

    __try{
        if (open_storage(filename) || hwp_file_check1(filename)) {
            printf("[+] Hwp file detected \n");

            __asm { MOV EBX, destname_p }

            hwp_dump(filename, &flag);

            __asm { SUB ESP, 8 }
        }
        else if (hwp_file_check2(filename)) {
            __asm {MOV ECX, destname_p}
            hwp_dump_workbook(filename, 0, &flag);
        }
        else {
            printf("[!] Invalid file\n");
            return -1;
        }

        printf("[+] Dumped %ls \n", filename);
    }

    __except (filter_exception(GetExceptionCode(), GetExceptionInformation())) {
        printf("[!] Exception Raised While Dumping : %ls\n", filename);
    }
}


int fuzz_hwp(wchar_t* filename) {
    int res = 0;
    dump_storage(filename);

    __asm { MOV ECX, output }

    res = scan_directory();

    __asm { MOV EDI, output }

    delete_temp_folder();
    return res;
}


int main(int argc, char** argv) {
    int res = 0;
    printf("[-] argv[1] : %s\n", argv[1]);
    printf("[-] argv[2] : %s\n", argv[2]);

    HINSTANCE HncAppShield = LoadLibrary(L"HncAppShield.dll");

    if (HncAppShield) {
        hwp_file_check1 = (HWP_FILE_CHECK1)((char*)GetProcAddress(HncAppShield, (LPCSTR)1) + 0x9640);
        hwp_file_check2 = (HWP_FILE_CHECK2)((char*)GetProcAddress(HncAppShield, (LPCSTR)1) + 0x1c840);
        hwp_dump = (HWP_DUMP)((char*)GetProcAddress(HncAppShield, (LPCSTR)1) + 0xc70);
        hwp_dump_workbook = (HWP_DUMP_WORKBOOK)((char*)GetProcAddress(HncAppShield, (LPCSTR)1) + 0xb70);
        open_storage = (OPENSTORAGE)((char*)GetProcAddress(HncAppShield, (LPCSTR)1) + 0x9eb0);
        scan_directory = (SCAN_DIRECTORY)((char*)GetProcAddress(HncAppShield, (LPCSTR)1) + 0x3b50);
        delete_temp_folder = (DELETE_TEMP_FOLDER)((char*)GetProcAddress(HncAppShield, (LPCSTR)1) - 0x300);
    }
    else {
        printf("[!] HncAppShield.dll not found\n");
    }

    // set input path
    input = charToWChar(argv[1]);
    printf("[+] Input : %ls\n", input);

    // set output path
    output = charToWChar(argv[2]);
    printf("[+] Output Folder : %ls\n", output);

    res = fuzz_hwp(input);
    printf("result : %d\n", res);
    return 0;
}
```
![](https://images.squarespace-cdn.com/content/v1/586a5e116a496327e94508e2/1517155595355-JKOMLC75NK5QQWXN8UXM/ke17ZwdGBToddI8pDm48kOKVxJQEJ9XB2olgTjMMmmNZw-zPPgdn4jUwVcJE1ZvWQUxwkmyExglNqGp0IvTJZUJFbgE-7XRK3dMEBRBhUpx-uD6EWp5wiaxlDdCZ6x6kbTwAhWdhx2nH4d9IbcZvmkjOmt69Gr2nHhD8nqSsOUo/2018-01-29+01%3B06%3B23.PNG?format=750w)
So now I have a final version of the loader. It loads stream files to memory and calls the memory scanning function. It's performance was up to around 80 execs per second without process nudging. 

```bash
afl-fuzz.exe -i BodyText -o out_bodytext -D D:\DynamoRIO\bin32 -t 10000 -- -coverage_module AppShieldDLL.dll -fuzz_iterations 5000 -target_module HncAppShieldLoader.exe -target_method fuzz_storage -nargs 2 -- .\HncAppShieldLoader.exe @@ BodyText
```

```C++
#include <stdio.h>
#include <Windows.h>
#include <iostream>

extern "C" __declspec(dllexport) int fuzz_storage(wchar_t* filename, char* storageType);
extern "C" __declspec(dllexport) int fuzz_hwp(wchar_t* hwp);

typedef int(*INSPECT)(wchar_t* filename);
typedef int(*MEMINSPECT)(void*, int, char*);

INSPECT AppShield_InspectMalware;
MEMINSPECT memory_inspect;

wchar_t* charToWChar(const char* text) {
    size_t size = strlen(text) + 1;
    wchar_t* wa = (wchar_t*)malloc(sizeof(wchar_t) * size);
    mbstowcs(wa, text, size);
    return wa;
}

int fuzz_hwp(wchar_t* filename) {
    AppShield_InspectMalware(filename);
    return 0;
}

int fuzz_storage(wchar_t* filename, char* storageType) {
    FILE* input;
    int fileSize = 0;
    int readbytes = 0;
    void* fileContents = 0;
    int ret = 0;

    if (!_wfopen_s(&input, filename, L"r+b")){
        if (input) {
            fseek(input, 0, SEEK_END);
            fileSize = ftell(input);

            if (fileSize != -1) {
                fseek(input, 0, 0);
                fileContents = malloc(fileSize);

                if (fileContents) {
                    readBytes = fread(fileContents, 1, fileSize, input);
                    if (readBytes != fileSize){
                        OutputDebugStringW(L"[!] File read error\n");
                    }

                    ret = memory_inspect(fileContents, readBytes, storageType);
                }
            }
        }

        free(fileContents);
        fclose(input);
    }

    return ret;
}

int main(int argc, char** argv) {
    HINSTANCE HncAppShield = LoadLibrary(L"HncAppShield.dll");

    int isDetected = 0;

    if (HncAppShield) {
        AppShield_InspectMalware = (INSPECT)GetProcAddress(HncAppShield, (LPCSTR)1);
        memory_inspect = (MEMINSPECT)((char*)GetProcAddress(HncAppShield, (LPCSTR)1) + 0x3620);
       
        if (argc == 2) {
            isDetected = fuzz_hwp(charToWChar(argv[1]));
        }
        if (argc == 3) {
            isDetected = fuzz_storage(charToWChar(argv[1]), argv[2]);
        }
    }

    printf("[Malware result] %d\n", isDetected);
    return isDetected;
}
```

![](https://images.squarespace-cdn.com/content/v1/586a5e116a496327e94508e2/1517145689027-TBT3D3KVKZTM2AAHTSL0/ke17ZwdGBToddI8pDm48kLW935fT3TYcJYfvZXSTwL5Zw-zPPgdn4jUwVcJE1ZvWQUxwkmyExglNqGp0IvTJZUJFbgE-7XRK3dMEBRBhUpyuH5k8SOUiqfJ5yMkvbTyRC7eMmGJvGo1IBZaQplTNnlZlxIUZrQvElzhgATN8HCI/final.PNG?format=750w)
최종적인 성능.


