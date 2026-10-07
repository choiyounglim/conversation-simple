# 🍅 토마토 마을 — 걸어다니는 홈페이지

스타듀밸리 / 그레이브야드 키퍼 느낌의 탑다운 마을 홈페이지.
방문객이 마을을 걸어다니며 건물에 들어가면 정보(소개, 프로젝트, 글, 연락처…)를 볼 수 있어요.

## 실행

`index.html`을 브라우저로 바로 열면 됩니다. (빌드 과정 없음, 순수 HTML/JS)

로컬 서버로 열고 싶으면:

```bash
cd village
npx serve .        # 또는  python -m http.server
```

## 조작

| 동작 | 키보드 | 마우스/터치 |
|---|---|---|
| 이동 | WASD / 방향키 | 땅 클릭 → 자동으로 걸어감 |
| 상호작용 | E / 스페이스 / 엔터 | 건물·NPC·표지판 클릭 → 걸어가서 자동 상호작용 |
| 건물 입장 | 문 앞에서 ↑ 또는 E | 건물 클릭 |
| 안내도 | M / Tab | 오른쪽 위 📜 버튼 |
| 닫기 | Esc | ✕ |

`index.html#about` 처럼 주소 뒤에 건물 id를 붙이면 그 건물이 바로 열려요 (링크 공유용).

## 파일 구조

```
village/
├─ index.html
├─ style.css
├─ js/
│  ├─ config.js   ← 에셋(이미지) 연결 설정
│  ├─ data.js     ← 마을 배치 + 홈페이지 내용 (여기만 고쳐도 대부분 해결)
│  └─ game.js     ← 엔진 (이동, 길찾기, 충돌, NPC, 렌더링)
└─ assets/        ← 유료 에셋을 여기에 복사
```

## 내용 바꾸기 — `js/data.js`

- `buildings[].content` : 건물에 들어갔을 때 보이는 HTML
- `npcs[].lines` : NPC 대사. `owner: true` 인 NPC가 "나"
- `signs` : 표지판 문구
- `paths`, `ponds`, `fountain`, 건물 좌표 : 마을 배치 (타일 단위, 1타일 = 16px)

## 에셋 연결 — `js/config.js`

1. 에셋을 복사:
   - `assets/ninja/` ← Ninja Adventure - Asset Pack
   - `assets/sprout/` ← Sprout Lands - Sprites - premium pack
   - `assets/ui/` ← MedievalUiMega
2. `config.js`의 `images` 경로를 실제 파일명에 맞게 수정
3. `index.html?debug` 로 열면 못 찾은 파일 목록 + 충돌 영역이 표시됨 (F3로 토글)

못 찾은 이미지는 자동으로 코드로 그린 기본 도트 그래픽으로 대체되기 때문에 하나씩 연결해도 돼요.

> ⚠️ 유료 에셋 라이선스는 보통 "게임/웹에 사용"은 허용하지만 "원본 파일 재배포"는 금지합니다.
> 공개(Public) GitHub 저장소에 에셋 원본을 그대로 올리면 재배포로 볼 수 있으니,
> 저장소를 비공개로 하거나 각 에셋의 라이선스를 확인하세요.
