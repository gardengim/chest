export const directionAngles={up:0,'up-right':45,right:90,'down-right':135,down:180,'down-left':225,left:270,'up-left':315} as const;
export type Direction=keyof typeof directionAngles;
