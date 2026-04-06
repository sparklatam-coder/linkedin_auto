# LinkedIn Auto Reply & DM

LinkedIn 포스트에 달린 댓글에 자동으로 대댓글과 DM을 보내는 CLI 도구.

## 어떻게 동작하나요?

1. LinkedIn 포스트 URL을 전달하면
2. 해당 포스트의 댓글을 수집하고
3. Claude CLI로 각 댓글에 맞는 대댓글과 DM을 생성한 뒤
4. 사용자가 확인/수정 후 승인하면
5. Puppeteer로 LinkedIn에 자동 전송합니다

## 사전 요구사항

- **Node.js** 18 이상
- **Claude CLI** 설치 및 로그인 ([설치 가이드](https://docs.anthropic.com/en/docs/claude-code))
- **LinkedIn 계정**

## 설치

```bash
git clone https://github.com/YOUR_USERNAME/linkedin-auto.git
cd linkedin-auto
npm install
```

## 설정

`.env.example`을 복사하여 `.env` 파일을 만들고 계정 정보를 입력합니다.

```bash
cp .env.example .env
```

```env
# LinkedIn 직접 로그인
LOGIN_METHOD=direct
LINKEDIN_EMAIL=your_email@example.com
LINKEDIN_PASSWORD=your_password

# DM에 자연스럽게 포함할 홍보 내용
PROMO_TEXT=홍보할 콘텐츠/서비스에 대한 설명
```

Google 계정으로 로그인하려면:

```env
LOGIN_METHOD=google
GOOGLE_EMAIL=your@gmail.com
GOOGLE_PASSWORD=your_password
```

## 사용법

### 전체 파이프라인 (권장)

```bash
npx tsx src/index.ts run "https://www.linkedin.com/posts/..."
```

스크랩 → 생성 → 리뷰(승인/수정/거절) → 전송이 순차 실행됩니다.

### 단계별 실행

```bash
# 1. 댓글 수집
npx tsx src/index.ts scrape "https://www.linkedin.com/posts/..."

# 2. 대댓글 & DM 생성 (Claude CLI 사용)
npx tsx src/index.ts generate

# 3. 터미널에서 승인/수정/거절
npx tsx src/index.ts review

# 4. 승인된 것만 전송
npx tsx src/index.ts send
```

### 수동 승인 방식

`generate` 후 `data/replies.json`, `data/messages.json` 파일을 직접 열어서 보내고 싶은 항목의 `"status": "pending"`을 `"status": "approved"`로 변경한 뒤 `send`를 실행할 수도 있습니다.

## 파이프라인 구조

```
[Login] → 세션 쿠키 저장/복원, 2FA 지원
    ↓
[Scrape] → 포스트 URL에서 댓글 수집 → data/comments.json
    ↓
[Generate] → Claude CLI로 대댓글/DM 생성 → data/replies.json, data/messages.json
    ↓
[Review] → 터미널 UI로 승인/수정/거절
    ↓
[Send] → Puppeteer로 대댓글 전송 + DM 전송
```

## 참고사항

- 첫 실행 시 LinkedIn 로그인이 필요합니다. 2FA가 뜨면 브라우저에서 직접 처리해주세요.
- 로그인 후 세션 쿠키가 `data/session.json`에 저장되어 다음 실행부터 로그인을 건너뜁니다.
- 각 전송 사이에 랜덤 딜레이(3~10초)가 적용되어 봇 감지를 방지합니다.
- LinkedIn의 DOM 구조가 변경되면 셀렉터 업데이트가 필요할 수 있습니다.

## 라이선스

MIT
