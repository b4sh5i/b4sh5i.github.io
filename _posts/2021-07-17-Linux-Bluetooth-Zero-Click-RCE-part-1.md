---
layout: post
title: Linux Bluetooth Zero-Click RCE part-1
subtitle: BleedingTooth Zero-Click Remote Code Execution 1day
tags: [JS, Study, Backup, BrowserExploit]
---

# 인트로
회사 취업전에 짤막하게 끄적여보는 글이다. 그래도 가기전에 감 찾기 용도로 linux kernel 1day 하나 분석하고 글 하나 정돈 쓰는거 나쁘지 않을꺼 같아서 글은 간략하게 페이로드는 좀 자세하게 쓰려고 써보는 글이다. 좀 코드보고 요약 형식으로 글을 쓰는거라, 두서없고 필요한 내용이 많이 부족 할 것이다. 그 점만 부탁...드립니다....

# 취약점
취약점은 `BadVibes`, `BadChoice`, `BadKarma` 이렇게 3개가 있었고, syzkaller 퍼저 쓰고 뭐 이런 저런 내용은 생략. 자세한건 해당 [글](https://google.github.io/security-research/pocs/linux/bleedingtooth/writeup#badkarma-heap-based-type-confusion-cve-2020-12351) 을 참고하자.


- [BadVibes](https://github.com/google/security-research/security/advisories/GHSA-ccx2-w2r4-x649) (CVE-2020-24490) was fixed on the mainline branch on 2020-Jul-30
- [BadChoice](https://github.com/google/security-research/security/advisories/GHSA-7mh3-gq28-gfrq) (CVE-2020-12352) and [BadKarma](https://github.com/google/security-research/security/advisories/GHSA-h637-c88j-47wq) (CVE-2020-12351) were fixed on bluetooth-next on 2020-Sep-25

이렇게 두개 가 있고, 각각 천천히 분석해보자. 

## BadVibes: Heap-Based Buffer Overflow (CVE-2020-24490)
간단한 힙오버였고, 생각보다 이런류의 취약점이 아직 존재한다라는 사실이 참 놀라웠다. 일단 기존에 `hci_le_adv_report_evt` 함수가 있는데, 이를 대체적? 으로 확장형 함수로 `hci_le_ext_adv_report_evt` 가 있다. 해당 코드를 보면.
```c++
static void hci_le_ext_adv_report_evt(struct hci_dev *hdev, struct sk_buff *skb)
{
	u8 num_reports = skb->data[0];
	void *ptr = &skb->data[1];

	hci_dev_lock(hdev);

	while (num_reports--) {
		struct hci_ev_le_ext_adv_report *ev = ptr;
		u8 legacy_evt_type;
		u16 evt_type;

		evt_type = __le16_to_cpu(ev->evt_type);
		legacy_evt_type = ext_evt_type_to_legacy(hdev, evt_type);
        // if (ev->length <= HCI_MAX_AD_LENGTH) { in hci_le_adv_report_evt function.
		if (legacy_evt_type != LE_ADV_INVALID) {
			process_adv_report(hdev, legacy_evt_type, &ev->bdaddr, // 1) 익스 백터.
					   ev->bdaddr_type, NULL, 0, ev->rssi,
					   ev->data, ev->length);
		}

		ptr += sizeof(*ev) + ev->length;
	}

	hci_dev_unlock(hdev);
}
```
코드를 좀 보면 `process_adv_report` 함수를 호출하게 되는데, 기존의 함수에는 `HCI_MAX_AD_LENGTH` 매크로를 통해 길이 검증 해야되는데 해당 부분이 없었다. 일단 길이 검증을 안하고 adv_report 를 하는데 해당 함수를 좀 더 확인 해보면.

```c++
static void process_adv_report(struct hci_dev *hdev, u8 type, bdaddr_t *bdaddr,
			       u8 bdaddr_type, bdaddr_t *direct_addr,
			       u8 direct_addr_type, s8 rssi, u8 *data, u8 len)
{
	...
	if (!has_pending_adv_report(hdev)) {
		...
		if (type == LE_ADV_IND || type == LE_ADV_SCAN_IND) {
			store_pending_adv_report(hdev, bdaddr, bdaddr_type, // 2) 여기까지 접근.
						 rssi, flags, data, len);
			return;
		}
		...
	}
	...
}
```
위처럼 `store_pending_adv_report` 함수를 호출한다. 해당 부분을 더 살펴 보면,


```c++
static void store_pending_adv_report(struct hci_dev *hdev, bdaddr_t *bdaddr,
				     u8 bdaddr_type, s8 rssi, u32 flags,
				     u8 *data, u8 len)
{
	struct discovery_state *d = &hdev->discovery;
	...
	memcpy(d->last_adv_data, data, len); // 3) Buffer overflow.
	d->last_adv_data_len = len;
}
```
꼴로 memcpy 를 한다. 결론은 len 길이 만큼 커널영역에 값을 덮어 쓸 수 있다. 하지만 이게 단독적으로 익스가 불가능하다. 덮혀지는 부분이 hci_dev 구조체 하나 정도 덮혀지는 수준인데, 그러면 hci_dev 에서 덮어야 할 부분을 찾아야된다. 추가로 문서에선 hci_dev 구조체가 약간 순환 ? linked list 느낌으로다가 순회 한다라고 한다. 무튼 결과적으로 hci_dev 구조체 전체 제어 가능한데, mgmt_pending->next 쪽 보면.

```C++
struct mgmt_pending_cmd {
	...
	int                        (*cmd_complete)(struct mgmt_pending_cmd *, u8);       /*  0x38   0x8 */

	/* size: 64, cachelines: 1, members: 8 */
	/* sum members: 62, holes: 1, sum holes: 2 */
};
```
처럼 vtable 이 있다. 해당 부분을 덮으면 될꺼 같다. 자세한건 이후에 서술.

## BadChoice: Stack-Based Information Leak (CVE-2020-12352)
`BadVibes` 취약점은 부분적으로 덮는 것 인데, 뭐든 익스를 하려면 덮을 주소를 릭 해야된다. 친절하게 릭 백터도 알려준다. 아무리 생각해도 개꿀 취약점인거 같다.
```C++
static int a2mp_getinfo_req(struct amp_mgr *mgr, struct sk_buff *skb,
			    struct a2mp_cmd *hdr)
{
	struct a2mp_info_req *req  = (void *) skb->data;
	...
	hdev = hci_dev_get(req->id);
	if (!hdev || hdev->dev_type != HCI_AMP) { // 데이터 검증하는데,
		struct a2mp_info_rsp rsp;

		rsp.id = req->id;
		rsp.status = A2MP_STATUS_INVALID_CTRL_ID;

		a2mp_send(mgr, A2MP_GETINFO_RSP, hdr->ident, sizeof(rsp), // 초기화 안함.
			  &rsp);

		goto done;
	}
	...
}
```
코드만 보고 생각한 내용은 `hdev->dev_type != HCI_AMP` 에 대해 패킷에 대한 검증을 하고 `rsp.status = A2MP_STATUS_INVALID_CTRL_ID;` 라고 하고 에러 처리를 해야대는데, 초기화 안하고 send 를 때려버린다. 근데 여기까지만 보면 데이터를 뭘 넘겨주는 지 모르겠어서 좀 더 분석 해봤는데. 

```C++
#define A2MP_GETINFO_RSP         0x07
struct a2mp_info_rsp {
	__u8	id;
	__u8	status;
	__le32	total_bw;
	__le32	max_bw;
	__le32	min_latency;
	__le16	pal_cap;
	__le16	assoc_size;
} __packed;

struct a2mp_info_rsp {
	/* typedef __u8 */ unsigned char              id;                                /*     0   0x1 */
	/* typedef __u8 */ unsigned char              status;                            /*   0x1   0x1 */
	/* typedef __le32 -> __u32 */ unsigned int               total_bw;               /*   0x2   0x4 */
	/* typedef __le32 -> __u32 */ unsigned int               max_bw;                 /*   0x6   0x4 */
	/* typedef __le32 -> __u32 */ unsigned int               min_latency;            /*   0xa   0x4 */
	/* typedef __le16 -> __u16 */ short unsigned int         pal_cap;                /*   0xe   0x2 */
	/* typedef __le16 -> __u16 */ short unsigned int         assoc_size;             /*  0x10   0x2 */

	/* size: 18, cachelines: 1, members: 7 */
	/* last cacheline: 18 bytes */
} __attribute__((__packed__));
```
위에는 엘릭서 코드 고 타입 으로 재 정의 한거 써놨다. 처음에 __u8 라고해서 unsigned int 꼴 이겠거니 했는데 알고보니깐 char 형이 였었다. 그럼 16바이트 정도 id 값을 통해 원하는 값을 가져올 수 있다.

```
Note that kernels compiled with CONFIG_INIT_STACK_ALL_PATTERN=y should not be vulnerable to such attacks. For example, on ChromeOS, BadChoice only returns 0xAA’s. However, this option does not seem to be enabled by default yet on popular Linux distros.
```

## BadKarma: Heap-Based Type Confusion (CVE-2020-12351)
```C++
tatic int l2cap_data_rcv(struct l2cap_chan *chan, struct sk_buff *skb)
{
	...
	if ((chan->mode == L2CAP_MODE_ERTM ||
	     chan->mode == L2CAP_MODE_STREAMING) && sk_filter(chan->data, skb))
		goto drop;
	...
}
```
`l2cap_data_rcv` 함수를 보면, `sk_filter` 함수를 호출한다. 이는 `L2CAP_MODE_STREAMING` 이거나, `L2CAP_MODE_ERTM` 일때 호출하는데.

```C++
static struct l2cap_chan *a2mp_chan_open(struct l2cap_conn *conn, bool locked)
{
	struct l2cap_chan *chan;
	int err;

	chan = l2cap_chan_create();
	if (!chan)
		return NULL;
	...
	chan->mode = L2CAP_MODE_ERTM; // 조건 가능.
	...
	return chan;
}
...
static struct amp_mgr *amp_mgr_create(struct l2cap_conn *conn, bool locked)
{
	struct amp_mgr *mgr;
	struct l2cap_chan *chan;

	mgr = kzalloc(sizeof(*mgr), GFP_KERNEL);
	if (!mgr)
		return NULL;
	...
	chan = a2mp_chan_open(conn, locked);
	if (!chan) {
		kfree(mgr);
		return NULL;
	}

	mgr->a2mp_chan = chan;
	chan->data = mgr;
	...
	return mgr;
}
```
오픈 때리고 create 하면 타입 컨퓨전 터진다. 이런 것도 있어서 신기하네.

# 요약
대충 분석한 내용은 이정도고...익스는 다음장에 쓰려고한다. 작업 환경이 애매해서 좀 수정이 많이 필요 할 꺼 같다. 데탑에서는 수월한데 맥북에서 잘 안되는 부분이 몇개 있어서 옮길 것도 많고 전역하고 몇일만에 만진거라 세팅하고 손 볼 부분이 많은 거 같다. 무튼 다음 장에서 익스 마무리 하고 정리 할 계획이다.