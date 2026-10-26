# AI가 다 한다면, 내 몫은 무엇일까

진로 독서 탐구 발표 (2026. 11. 9.). 『AI가 다 하고 내가 돈 버는 앱 만들기』를 읽고 과목 선택 도우미 [과목내비](https://navi.milky.kr)를 만든 이야기를 8장으로 정리했다. 디자인은 과목내비 사이트와 같다.

## 보기

| 주소 | 내용 |
|---|---|
| `index.html` | 발표 화면 (청중용) |
| `index.html?view=presenter` | 발표자 화면: 노트, 지금 장·다음 장, 시간. 발표 화면에서 `S`를 누르면 새 창으로 열리고, 두 창이 같은 장을 따라간다 |
| `notes.html` (= `index.html?view=script`) | 발표 대본: 장마다 노트와 예상 시간, 발표 전 준비, 5장 그래프 자료. 인쇄용 |

## 조작

`→` `Space` `PageDown` 다음 장 · `←` `PageUp` 이전 장 · `Home` `End` 처음·끝 · 숫자 + `Enter` 그 장으로 · `F` 전체 화면 · `S` 발표자 화면 · `B` 화면 가리기. 휴대폰은 옆으로 밀어서 넘긴다.

PDF가 필요하면 발표 화면에서 인쇄(Ctrl+P) → PDF로 저장 (배경 그래픽 켜기). 장마다 한 쪽씩 1920×1080으로 나온다.

## 고치기

- 글과 노트: `index.html`. 장마다 `<section class="slide">` 하나, 노트는 그 안의 `<aside class="notes" data-sec="초">` (`data-sec`는 발표자 화면·대본의 예상 시간). 노트 문단에 `class="cue"`를 주면 '동작', `class="opt"`를 주면 '생략 가능' 표시가 붙는다.
- 모양: `deck.css` (색·글꼴은 사이트 `styles.css`와 같은 값). 움직임: `deck.js`.
- 6장 숫자는 2026. 10. 26. 운영 서버 기준이다. 발표 전에 바꾼다.

## GitHub Pages로 올리기

이 폴더를 저장소 맨 위에 두고 Settings → Pages → Deploy from a branch → `main` / `(root)`. 빌드 과정은 없다. 글꼴(Pretendard)은 jsDelivr에서 불러오고, 인터넷이 없으면 맑은 고딕으로 보인다.
