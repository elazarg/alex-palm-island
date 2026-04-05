export function createMeterAnimationState(amount = 100) {
  return {
    amount,
    coin: null,
  };
}

export function startMeterAmountAnimation(state, fromAmount, toAmount, layout) {
  if (!state || fromAmount === toAmount) return;
  const direction = toAmount < fromAmount ? 'out' : 'in';
  state.amount = toAmount;
  state.coin = {
    direction,
    tick: 0,
    frameIndex: 0,
    x: direction === 'out' ? layout.money.coinOutStartX : layout.money.coinInStartX,
    y: layout.money.coinY,
    startX: direction === 'out' ? layout.money.coinOutStartX : layout.money.coinInStartX,
    endX: direction === 'out' ? layout.money.coinOutEndX : layout.money.coinInEndX,
    durationTicks: layout.money.coinDurationTicks || 24,
    frameTicks: layout.money.coinFrameTicks || 3,
  };
}

export function tickMeterAnimation(state) {
  if (!state?.coin) return;
  const coin = state.coin;
  coin.tick++;
  if (coin.tick % coin.frameTicks === 0) {
    coin.frameIndex = (coin.frameIndex + 1) % 4;
  }
  const progress = Math.min(1, coin.tick / coin.durationTicks);
  coin.x = Math.round(coin.startX + (coin.endX - coin.startX) * progress);
  if (progress >= 1) {
    state.coin = null;
  }
}
