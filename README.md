# Snowmen Adventure Level Editor

퍼즐 게임 *Snowmen Adventure* 의 레벨을 만들고 시뮬레이션해볼 수 있는 웹 에디터.

## 라이브 데모

배포: [https://snowmen-adventure-editor.vercel.app](https://snowmen-adventure-editor.vercel.app) *(Vercel 연결 후 실제 주소로 갱신)*

## 기술 스택

- React 19 + TypeScript
- Vite
- `vite-plugin-singlefile` — 단일 HTML 파일로 빌드되어 공유에 용이

## 로컬 개발

```bash
npm install
npm run dev      # 개발 서버
npm run build    # 단일 HTML 파일로 빌드 (dist/index.html)
npm run preview  # 빌드 결과 미리보기
```

## 배포

`main` 브랜치에 푸시하면 Vercel이 자동으로 빌드해서 배포함.

```bash
git add .
git commit -m "수정 내용"
git push
```
