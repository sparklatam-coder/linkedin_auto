---
description: 이미 수동으로 댓글을 달다가 이 프로그램을 쓰는 경우 — 기존 대댓글 감지 후 스킵 처리
---

# LinkedIn Already Replied 처리

이미 수동으로 일부 댓글에 대댓글을 달다가 자동화 프로그램을 사용하는 경우.
기존에 이미 대댓글이 달린 댓글을 감지하여 contacts.json에서 skipped로 표시.

## 사용 시나리오

1. 포스트에 댓글이 100개 달림
2. 사용자가 수동으로 30개에 대댓글을 달음
3. 나머지 70개를 자동화하고 싶음
4. `/linkedin_already URL`을 먼저 실행 → 이미 대댓글 단 30개를 skipped 처리
5. 그 후 `/linkedin URL`을 실행 → 나머지 70개만 처리

## 실행 방법

```bash
cd /Users/joseph/linkedin
npx tsx src/index.ts scrape "<URL>"
```

scrape 시 각 댓글의 대댓글 영역(reply thread)이 존재하는지 확인:
- 해당 댓글 아래에 `article.comments-comment-entity--reply`가 있으면 → 누군가 이미 대댓글을 달았음
- 그 reply의 작성자가 나(프로필 URL 매칭)면 → `reply.status: 'skipped'`

## 감지 방법

LinkedIn에서 대댓글이 달린 댓글은:
1. 댓글 아래에 reply article이 존재함
2. reply 영역에 "추천", "답장" 버튼이 활성화되어 있음
3. 내 대댓글인 경우 프로필 링크가 내 URL과 일치

scrape.ts에서 이 감지 로직을 실행하여 이미 대댓글 단 것을 자동 스킵 처리.
