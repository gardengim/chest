import {expect,type Page} from '@playwright/test';

export async function settleFiniteAnimations(page:Page){
  // Observe live state: a replaced/cancelled animation can leave a previously
  // captured finished promise pending even though it no longer changes pixels.
  await expect.poll(()=>page.evaluate(()=>document.getAnimations().filter(animation=>
    animation.playState==='running' && animation.effect?.getTiming().iterations!==Infinity,
  ).length)).toBe(0);
}
