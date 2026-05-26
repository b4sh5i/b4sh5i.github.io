import './style.css';
import { Game } from './game/Game';

const game = new Game();
game.start();

// 디버깅 편의: 콘솔에서 game 접근 가능하게 (개발 시에만 유용)
(window as unknown as { __game?: Game }).__game = game;
