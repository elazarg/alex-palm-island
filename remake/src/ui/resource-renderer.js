export function renderResourcePopup(ctx, { assets, modal }) {
  const img = assets.get(modal.asset);
  if (!img) return;
  ctx.drawImage(img, 0, 0);
}
