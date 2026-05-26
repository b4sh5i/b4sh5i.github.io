import { defineConfig } from 'vite';

// Spireborn/app/ 가 Vite 프로젝트 루트.
// 빌드는 부모인 Spireborn/ 에 떨어뜨려, https://b4sh5i.github.io/Spireborn/ 에서 바로 서빙되게 한다.
// base 는 상대 경로로 두어 어느 서브경로에 마운트되든 동작.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: '..',
    assetsDir: 'assets',
    // 출력 디렉토리가 프로젝트 루트 바깥(부모)이라 emptyOutDir 는 켜지 않는다.
    emptyOutDir: false,
  },
  server: {
    host: true,
  },
});
