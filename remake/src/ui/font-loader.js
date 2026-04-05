import { BitmapFont } from './bitmap-font.js';

export async function loadBitmapFont(basePath = '../assets') {
  const fontData = await (await fetch(`${basePath}/mainfont.json`)).json();
  const fontImg = new Image();
  await new Promise((resolve, reject) => {
    fontImg.onload = resolve;
    fontImg.onerror = reject;
    fontImg.src = `${basePath}/mainfont.png`;
  });
  return new BitmapFont(fontImg, fontData);
}
