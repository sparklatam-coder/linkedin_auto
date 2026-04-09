---
description: LinkedIn 포스트에 달린 댓글에 대댓글 + DM 자동 전송
---

# LinkedIn 댓글 자동 대댓글 & DM

LinkedIn 포스트 URL을 받아서, 댓글 수집 → DM 내용 설정 → 승인 → 1촌체크 → DM → 대댓글 전송.

## 실행 순서

### Step 1: URL 입력받기

사용자가 URL을 인자로 전달하거나, 없으면 질문한다.

### Step 2: 댓글 수집 + 좋아요

```bash
cd /Users/joseph/linkedin
npx tsx src/index.ts scrape "<URL>"
```

- 새 댓글만 추가 수집 (기존 contacts.json에 누적)
- 이미 대댓글 단 사람은 skipped 처리
- 모든 댓글에 좋아요

수집된 새 댓글 목록을 사용자에게 보여준다.

### Step 3: DM 내용 설정

사용자에게 DM 메시지 내용을 질문한다. 모든 사람에게 동일한 DM이 전송된다.
contacts.json에서 pending인 사람들의 dm.content를 설정한다.

### Step 4: 승인 받기

대댓글과 DM 내용을 테이블로 보여주고 승인을 받는다.
- 대댓글은 DM 결과에 따라 자동 결정:
  - 1촌 → "00님, DM 곧 보내드리겠습니다 :)"
  - 1촌 아님 → "00님, 1촌이어야 DM을 보내드릴 수 있습니다. 1촌 신청 부탁드립니다 :)"

승인되면:
```bash
cd /Users/joseph/linkedin
npx tsx src/index.ts approve
```

### Step 5: 전송

```bash
cd /Users/joseph/linkedin
npx tsx src/index.ts send
```

실행 순서:
1. 1촌 여부 체크 (프로필 방문)
2. DM 먼저 전송 (1촌만)
3. 대댓글 전송 (DM 결과에 따라 내용 자동 결정)

전송 결과를 사용자에게 보고한다.

## 주의사항

- 브라우저가 열리면 2FA가 필요할 수 있음 — 사용자가 브라우저에서 직접 처리
- 세션 쿠키가 저장되어 있으면 로그인 스킵됨
- DM 메시지에 줄바꿈이 있으면 Shift+Enter로 처리됨
- 이미 DM 보낸 사람은 자동 스킵 (중복 방지)
- 이미 대댓글 단 사람은 자동 스킵
- contacts.json에 모든 상태가 누적 관리됨
