---
layout: post
title: CodeQL 사용기 문서 정리
subtitle: CVE-2019-3560 1day 분석
tags: [Linux, Kernel]
---


# CodeQL 취약점 모델링

위의 분석을 통해 42개의 행에서 짧은 정수에 대한 할당이 수행되어 정수 오버플로가 발생하여 데드 루프가 발생합니다.`length >= 0xFFFB`

그래서 문제의 핵심은 다음과 같습니다 : 공격자가 제어 할 수 있는지 어떻게 알 수 있습니까?

# 모델링 아이디어

CodeQL이 사용자가 제어할 수 있는 이 입력 지점을 찾는 방법을 살펴보겠습니다.

CodeQL은 스팟 분석 기능을 가지고 있으며, 즉 입력 점 소스, 대상 점 sink를 정의할 수 있는 경우 CodeQL을 사용하여 두 점 사이에 데이터 흐름 경로가 있는지 여부를 확인할 수 있습니다.

여기서 sink는 정수 오버플로 패턴이며, 더 잘 정의되고, 큰 정수가 작은 정수로 변환되고, 부호 없는 경우, 정수 오버플로 문제가 발생할 수 있습니다.

소스는 정의하기가 더 어렵고 사용자 입력이 제어할 수 있는 변수를 식별하는 모델을 정의해야 하며, 이는 대상 프로젝트의 구체적인 구현이 더 감사되어야 합니다.

특히 Fizz는 Facebook의 기본 C++ 클래스 라이브러리 folly를 사용하여 수신된 네트워크 데이터를 저장하는 데 사용되므로 개체를 source로 정의하는 것이 더 직접적인 생각입니다.`folly::IOBufQueuefolly::IOBufQueue`

그러나 semmle의 연구원들은 Fizz 시나리오에서 네트워크 데이터가 안전하지 않은 입력에 대한 보다 일반적인 아이디어를 제공합니다. 데이터가 소켓을 통해 전송될 때 일반적으로 전송되며 서비스 측에서 수신후 일반적으로 함수를 통해 변환해야 합니다. 는 작은 끝 순서이며 x86 아키텍처의 큰 끝 순서, 즉 host는 네트워크에서 데이터를 수신한 후 작은 끝 순서에서 큰 끝 시퀀스로 변환해야 합니다. Fizz 엔지니어링에서는 표준 라이브러리의 함수를 호출하지 않고 동일한 기능을 가진 folly 기본 클래스 라이브러리의 함수를 호출합니다. 따라서 함수 호출을 source로 정의할 수 있습니다.`network byte orderhost bytes orderntohs/ntohl (Network to Host Short/Long)network byte orderhost byte orderntohs/ntohlfolly::Endian::bigfolly::Endian::big`

# QL 모델링 구현

그런 다음 CodeQL의 쿼리 언어 QL을 사용하여 정의한 모델을 설명합니다.

먼저 필요한 라이브러리를 가져옵니다.

```
import cpp
import semmle.code.cpp.ir.dataflow.TaintTracking
import semmle.code.cpp.ir.IR
import DataFlow::PathGraph

```

여기에 cpp 코어 라이브러리, 스팟 추적 라이브러리, 중간 언어 라이브러리 및 데이터 흐름 분석 라이브러리가 사용됩니다.

그런 다음 함수의 일치 메서드를 정의합니다.`folly::Endian::big`

```
class EndianConvert extends Function {
  EndianConvert() {
    this.getName() = "big" and
    this.getDeclaringType().getName().matches("Endian")
  }
}

```

함수 일치를 통해 네트워크 데이터를 정의합니다.`folly::Endian::big`

```
predicate isNetworkData(Instruction i) {
  i.(CallInstruction).getCallTarget().(FunctionInstruction).getFunctionSymbol() instanceof
    EndianConvert
}

```

위험한 정수 변환을 결정하는 또 다른 방법을 정의합니다.

```
predicate isNarrowingConversion(ConvertInstruction i) {
  i.getResultSize() < i.getUnary().getResultSize()
}

```

여기서는 CodeQL 라이브러리를 사용하여 모든 유형의 데이터 변환 작업을 일치시킬 수 있는 중간 언어 표현의 가치를 반영합니다.`ConvertInstruction`

그런 다음 위의 판단 방법을 사용하여 스팟 분석의 source 및 sink을 정의합니다.

```
class Cfg extends TaintTracking::Configuration {
  Cfg() { this = "FizzOverflowIR" }
  override predicate isSource(DataFlow::Node source) {
    isNetworkData(source.asInstruction())
  }
  override predicate isSink(DataFlow::Node sink) {
    isNarrowingConversion(sink.asInstruction())
  }
}

```

최종 찾기 및 출력 수행:

```
from
  Cfg cfg, DataFlow::PathNode source, DataFlow::PathNode sink, ConvertInstruction conv,
  Type inputType, Type outputType
where
  cfg.hasFlowPath(source, sink) and
  conv = sink.getNode().asInstruction() and
  inputType = conv.getUnary().getResultType() and
  outputType = conv.getResultType()
select sink, source,
  "Conversion of untrusted data from " + inputType + " to " + outputType + "."

```

여기서 가장 중요한 판단은 스팟 분석을 통해 우리가 정의하는 surce와 sink 사이에 데이터 흐름 경로가 있는지 여부를 결정하는 것입니다.

이 쿼리를 사용하면 다음 그림과 같이 Fizz 엔지니어링에서 세 가지 문제를 필터링할 수 있습니다.

![https://lenny233.github.io/images/blog_pic/2020-02-20_2.png](https://lenny233.github.io/images/blog_pic/2020-02-20_2.png)