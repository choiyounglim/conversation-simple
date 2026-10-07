/*
 * 마을 데이터 — 건물, NPC, 표지판, 길, 연못 배치와 홈페이지 내용.
 * 좌표 단위는 "타일"(16px). 지도 크기는 map.w x map.h 타일.
 * 내용(content)은 HTML 문자열이라 링크, 이미지, 목록 등 자유롭게 넣을 수 있어요.
 */
window.VILLAGE = {
  title: '토마토 마을',
  seed: 20261007,          // 나무/꽃 랜덤 배치 시드 (바꾸면 배치가 달라짐)
  map: { w: 50, h: 36 },
  spawn: { tx: 24, ty: 31 }, // 방문객 시작 위치
  randomTrees: 45,

  // 길: [x, y, 너비, 높이]
  paths: [
    [2, 19, 46, 2],   // 큰 가로길
    [4, 30, 42, 2],   // 아래 가로길
    [24, 11, 2, 21],  // 세로길
    [20, 16, 10, 8],  // 광장
    [8, 14, 1, 5],    // 나의 집 진입로
    [16, 14, 1, 5],   // 작업실 진입로
    [33, 14, 1, 5],   // 도서관 진입로
    [42, 14, 1, 5],   // 갤러리 진입로
    [10, 29, 1, 1],   // 우체국 진입로
  ],

  ponds: [{ cx: 38, cy: 25, rx: 5, ry: 3 }],
  fountain: { tx: 24, ty: 18 },

  // 건물: tx,ty = 왼쪽 위 타일, w,h = 타일 크기, door = 왼쪽에서 몇 번째 타일이 문인지
  // sprite = config.js 의 buildings 키 (없으면 기본 그래픽)
  buildings: [
    {
      id: 'about', name: '나의 집', icon: '🏠', tx: 5, ty: 9, w: 6, h: 5, door: 3,
      roof: '#c8553d', sprite: 'home',
      content: `
        <h2>안녕하세요! 👋</h2>
        <p>이 마을의 주인입니다. 여기에 자기소개를 적어주세요.</p>
        <ul>
          <li>이름: 홍길동</li>
          <li>하는 일: 무엇을 만드는 사람</li>
          <li>좋아하는 것: 게임, 도트 그래픽, 토마토</li>
        </ul>`,
    },
    {
      id: 'projects', name: '작업실', icon: '🔨', tx: 13, ty: 9, w: 6, h: 5, door: 3,
      roof: '#4f7cac', sprite: 'workshop',
      content: `
        <h2>프로젝트</h2>
        <div class="card"><h3>프로젝트 A</h3><p>설명을 적어주세요.</p><a href="#" target="_blank" rel="noopener">보러가기 →</a></div>
        <div class="card"><h3>프로젝트 B</h3><p>설명을 적어주세요.</p><a href="#" target="_blank" rel="noopener">보러가기 →</a></div>`,
    },
    {
      id: 'blog', name: '도서관', icon: '📚', tx: 30, ty: 8, w: 7, h: 6, door: 3,
      roof: '#7a5c99', sprite: 'library',
      content: `
        <h2>글 모음</h2>
        <ul>
          <li><a href="#" target="_blank" rel="noopener">첫 번째 글 제목</a> <small>2026.10.01</small></li>
          <li><a href="#" target="_blank" rel="noopener">두 번째 글 제목</a> <small>2026.09.15</small></li>
        </ul>`,
    },
    {
      id: 'gallery', name: '갤러리', icon: '🖼️', tx: 39, ty: 9, w: 6, h: 5, door: 3,
      roof: '#d49a2a', sprite: 'gallery',
      content: `
        <h2>갤러리</h2>
        <p>작품 이미지를 넣어주세요. 예: <code>&lt;img src="images/work1.png"&gt;</code></p>
        <div class="grid"><div class="thumb">1</div><div class="thumb">2</div><div class="thumb">3</div></div>`,
    },
    {
      id: 'contact', name: '우체국', icon: '✉️', tx: 7, ty: 24, w: 6, h: 5, door: 3,
      roof: '#3d8b5a', sprite: 'post',
      content: `
        <h2>연락하기</h2>
        <ul>
          <li>이메일: <a href="mailto:hello@example.com">hello@example.com</a></li>
          <li>GitHub: <a href="https://github.com/" target="_blank" rel="noopener">github.com/아이디</a></li>
        </ul>`,
    },
  ],

  // NPC: sprite = config.js 의 characters 키, wander = 돌아다니는 반경(타일)
  // colors = 에셋이 없을 때 기본 그래픽 색상
  npcs: [
    {
      id: 'me', name: '나 (집주인)', owner: true, tx: 11, ty: 15, wander: 2, sprite: 'me',
      colors: { hair: '#3b2a20', shirt: '#e05a47', pants: '#3a4a6b' },
      lines: ['어서 와요! 제 마을에 놀러 와줘서 고마워요.', '집 안에 제 소개가 있어요. 문 앞에서 E를 눌러보세요!'],
      after: 'about', // 대화가 끝나면 이 건물 열기 (원하지 않으면 지우기)
    },
    {
      id: 'chief', name: '촌장', tx: 21, ty: 22, wander: 3, sprite: 'chief',
      colors: { hair: '#dddddd', shirt: '#7b5e3b', pants: '#4a3b2a' },
      lines: ['허허, 처음 보는 얼굴이구먼.', '방향키나 WASD로 걷고, 건물을 클릭하면 알아서 걸어간다네.', '오른쪽 위 📜 버튼을 누르면 마을 안내도도 볼 수 있지.'],
    },
    {
      id: 'smith', name: '대장장이', tx: 18, ty: 16, wander: 2, sprite: 'smith',
      colors: { hair: '#8a3b1e', shirt: '#555b66', pants: '#2f2f38' },
      lines: ['작업실엔 주인장이 만든 것들이 잔뜩 있지!'],
    },
    {
      id: 'librarian', name: '사서', tx: 36, ty: 16, wander: 2, sprite: 'librarian',
      colors: { hair: '#2b2b4a', shirt: '#9a6fc7', pants: '#3a2f4a' },
      lines: ['도서관에서는 조용히... 주인장의 글을 읽어볼 수 있어요.'],
    },
    {
      id: 'postman', name: '우체부', tx: 14, ty: 30, wander: 3, sprite: 'postman',
      colors: { hair: '#5a3a1a', shirt: '#3b6fd1', pants: '#2a3550' },
      lines: ['편지 보낼 일 있으면 우체국으로 오세요!'],
    },
    {
      id: 'kid', name: '꼬마', tx: 31, ty: 27, wander: 2, sprite: 'kid',
      colors: { hair: '#e0b040', shirt: '#5cc06a', pants: '#3a5a8a' },
      lines: ['연못에 물고기가 있대요! 근데 아직 못 잡았어요...'],
    },
  ],

  signs: [
    { tx: 27, ty: 29, title: '안내판', lines: ['토마토 마을에 오신 걸 환영합니다!', '건물에 들어가면 주인장의 이야기를 볼 수 있어요.'] },
    { tx: 26, ty: 11, title: '표지판', lines: ['↑ 북쪽 숲 — 아직 공사 중'] },
  ],
};
