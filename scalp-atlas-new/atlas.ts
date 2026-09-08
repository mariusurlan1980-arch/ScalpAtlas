export const SCALP_ATLAS_MODELS = [
  'Dublu Minim','Dublu Maxim','Triplu Minim','Triplu Maxim','V Bottom','V Top','Rotunjire (Bottom)','Rotunjire (Top)','1-2-3 Bottom','1-2-3 Top',
  'Triunghi Ascendent','Triunghi Descendent','Triunghi Simetric','Triunghi Expanding','Wedge Ascendent','Wedge Descendent','Canal Ascendent','Canal Descendent','Canal Orizontal','Compresie (Squeeze)',
  'Breakout Rezistență','Breakout Suport','Breakout Fals (Bull Trap)','Breakout Fals (Bear Trap)','Breakout + Retest','Steag Ascendent','Steag Descendent','Pennant Ascendent','Pennant Descendent','Dreptunghi Continuare',
  'Rejecție sus (Upper Wick)','Rejecție jos (Lower Wick)','Pin Bar Bullish','Pin Bar Bearish','Engulfing Bullish','Engulfing Bearish','Inside Bar','Outside Bar','Fakey (Inside → Break)','Mother Bar',
  'Dublu Minim + Divergență','Dublu Maxim + Divergență','Triunghi + Breakout','Wedge + Breakout','Canal + Breakout','Retest + Rejecție','Breakout + Retest + Continuare','Compresie + Breakout','S&R Flip (Suport devine Rezistență)','Confluență Multi-Structuri',
  'Head & Shoulders','Head & Shoulders inversat','Cup & Handle','Cup & Handle inversat','Diamond Top','Diamond Bottom','Megaphone / Broadening Top','Broadening Bottom','Hammer','Inverted Hammer',
  'Shooting Star','Hanging Man','Morning Star','Evening Star','Tweezer Bottom','Tweezer Top','Three White Soldiers','Three Black Crows','Bullish Harami','Bearish Harami'
] as const;

export const SCALP_ATLAS_COUNT = SCALP_ATLAS_MODELS.length;

if (SCALP_ATLAS_COUNT !== 70) {
  throw new Error(`SCALP ATLAS trebuie să conțină exact 70 de modele; găsite: ${SCALP_ATLAS_COUNT}`);
}
