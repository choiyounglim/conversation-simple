/*
 * 에셋 설정 — 가지고 있는 유료 에셋을 게임에 연결하는 곳.
 *
 * 1) 에셋 폴더를 village/assets/ 아래로 복사:
 *      village/assets/ninja/   ← "Ninja Adventure - Asset Pack" 폴더 내용
 *      village/assets/sprout/  ← "Sprout Lands - Sprites - premium pack" 폴더 내용
 *      village/assets/ui/      ← "MedievalUiMega" 폴더 내용
 * 2) 아래 images 의 경로를 실제 파일 경로에 맞게 수정.
 * 3) 브라우저에서 index.html?debug 로 열면 못 찾은 파일 목록이 화면에 나와요.
 *
 * 파일을 못 찾으면 자동으로 기본 도트 그래픽으로 대체되니, 하나씩 연결해도 돼요.
 */
window.ASSET_CONFIG = {
  basePath: 'assets/',
  useAssets: true,

  // 이미지 키: basePath 기준 경로. (아래 경로는 예시/추정 — 실제 폴더 구조에 맞게 고치세요)
  images: {
    visitor:   'ninja/Actor/Characters/BlueNinja/SpriteSheet.png',
    me:        'ninja/Actor/Characters/RedNinja/SpriteSheet.png',
    chief:     'ninja/Actor/Characters/OldMan/SpriteSheet.png',
    smith:     'ninja/Actor/Characters/Samurai/SpriteSheet.png',
    librarian: 'ninja/Actor/Characters/Princess/SpriteSheet.png',
    postman:   'ninja/Actor/Characters/Villager/SpriteSheet.png',
    kid:       'ninja/Actor/Characters/Villager2/SpriteSheet.png',

    // 예시 — Sprout Lands 타일/오브젝트 (경로 확인 후 주석 해제)
    // grassTiles: 'sprout/Tilesets/Grass.png',
    // houseTiles: 'sprout/Objects/Wooden House.png',

    // 예시 — MedievalUiMega 대화창/패널용 9-slice 이미지
    // panel: 'ui/Panel/panel_brown.png',
  },

  // 캐릭터 스프라이트시트 규칙
  //  layout 'colsDir': 열 = 방향, 행 = 걷기 프레임   (Ninja Adventure SpriteSheet.png)
  //  layout 'rowsDir': 행 = 방향, 열 = 걷기 프레임   (Sprout Lands 캐릭터 시트)
  //  dirs: 시트에 들어있는 방향 순서
  characters: {
    _default: { frameW: 16, frameH: 16, layout: 'colsDir', dirs: ['down', 'up', 'left', 'right'], frames: 4, originX: 0, originY: 0, footOffset: 0 },
    visitor:   { image: 'visitor' },
    me:        { image: 'me' },
    chief:     { image: 'chief' },
    smith:     { image: 'smith' },
    librarian: { image: 'librarian' },
    postman:   { image: 'postman' },
    kid:       { image: 'kid' },
    // Sprout Lands 캐릭터 예시:
    // visitor: { image: 'sproutChar', frameW: 48, frameH: 48, layout: 'rowsDir', dirs: ['down','up','left','right'], frames: 4, footOffset: 16 },
  },

  // 바닥 타일 (여러 개 넣으면 랜덤으로 섞여요). sx,sy = 시트 안의 픽셀 위치, 16x16
  tiles: {
    // grass: [{ image: 'grassTiles', sx: 16, sy: 16 }, { image: 'grassTiles', sx: 32, sy: 16 }],
    // path:  [{ image: 'grassTiles', sx: 128, sy: 16 }],
    // water: [{ image: 'waterTiles', sx: 0, sy: 0 }],
  },

  // 오브젝트 / 건물 스프라이트: 이미지의 (sx,sy,sw,sh) 영역을 잘라서
  // 바닥 중앙에 맞춰 그림. 건물 키는 data.js 의 building.sprite 와 같아야 해요.
  objects: {
    // tree: { image: 'treeImg', sx: 0, sy: 0, sw: 32, sh: 48 },
  },
  buildings: {
    // home: { image: 'houseTiles', sx: 0, sy: 0, sw: 96, sh: 96 },
  },

  // 대화창/패널 테두리 (9-slice). slice = 모서리 픽셀 크기
  ui: {
    // panel: { image: 'panel', slice: 8, width: 24 },
  },
};
