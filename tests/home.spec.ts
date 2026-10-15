import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {openHomeTool} from './home-helpers';

test('dock reorders and hides shelves, persists, and leaves every tool accessible',async({page})=>{
  await page.goto('/');
  const dock=page.getByRole('navigation',{name:'Home sections'});
  const visible=dock.getByRole('group',{name:'Visible sections'});
  await expect(visible.getByRole('button')).toHaveCount(3);
  const news=visible.getByRole('button',{name:'News',exact:true});
  await news.focus();await page.keyboard.press('Alt+ArrowLeft');
  await expect(visible.getByRole('button').first()).toHaveAttribute('data-section','news');
  await expect(page.locator('[data-home-section]').first()).toHaveAttribute('data-home-section','news');
  await news.focus();await page.keyboard.press('Alt+ArrowDown');
  await expect(page.locator('[data-home-section="news"]')).toHaveCount(0);
  await page.reload();
  await expect(visible.getByRole('button')).toHaveCount(2);
  await openHomeTool(page,'News');
  await expect(page.getByRole('heading',{name:'News',exact:true,level:1})).toBeVisible();
  await expect(page.locator('[data-home-section]')).toHaveCount(1);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('chest-ui-preferences-v1')!).homeShelves)).toEqual(['instances','explore']);
  await page.getByRole('button',{name:'Chest home',exact:true}).click();
  for(const section of ['Instances','Explore']){const button=visible.getByRole('button',{name:section,exact:true});await button.focus();await page.keyboard.press('Alt+ArrowDown');}
  await expect(page.getByText('Your home is empty')).toBeVisible();
  await openHomeTool(page,'Servers');
  await expect(page.getByRole('heading',{name:'Servers',exact:true,level:1})).toBeVisible();
  await expect(page.locator('aside button')).toHaveCount(3);
});

test('pointer dragging reveals hidden tools, adds shelves, and reorders the home',async({page})=>{
  await page.goto('/');
  const dock=page.getByRole('navigation',{name:'Home sections'});
  await dock.getByRole('button',{name:'More',exact:true}).click();
  await expect(dock.getByRole('button',{name:'Worlds',exact:true})).toBeVisible();
  await expect.poll(()=>dock.evaluate(node=>node.getAnimations({subtree:true}).filter(animation=>animation.playState==='running').length)).toBe(0);
  await expect(dock.locator('[data-section] svg')).toHaveCount(0);
  await expect(dock.getByRole('button',{name:'News',exact:true})).toHaveText('News');
  const worlds=dock.getByRole('button',{name:'Worlds',exact:true});
  const instances=dock.getByRole('button',{name:'Instances',exact:true});
  const from=(await worlds.boundingBox())!,to=(await instances.boundingBox())!;
  await page.mouse.move(from.x+20,from.y+20);await page.mouse.down();await page.mouse.move(to.x+2,to.y+20,{steps:10});await page.mouse.up();
  await expect(page.locator('[data-home-section]').first()).toHaveAttribute('data-home-section','worlds');
  await expect(page.locator('[data-home-section="worlds"]')).toContainText('No worlds');
  const visible=dock.getByRole('group',{name:'Visible sections'});
  await expect.poll(()=>dock.evaluate(node=>node.getAnimations({subtree:true}).filter(animation=>animation.playState==='running').length)).toBe(0);
  const start=(await visible.getByRole('button',{name:'Instances',exact:true}).boundingBox())!;
  const end=(await visible.getByRole('button',{name:'Explore',exact:true}).boundingBox())!;
  await page.mouse.move(start.x+20,start.y+20);await page.mouse.down();await page.mouse.move(end.x+end.width-2,end.y+20,{steps:10});await page.mouse.up();
  await expect(visible.getByRole('button').last()).toHaveAttribute('data-section','instances');
  await dock.getByRole('button',{name:'Instances',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>{
    const main=document.querySelector('main')!.getBoundingClientRect();
    const shelf=document.querySelector('[data-home-section="instances"]')!.getBoundingClientRect();
    return shelf.top>=main.top-1 && shelf.bottom<=main.bottom-88+1;
  })).toBe(true);
  await page.locator('main').evaluate(node=>node.dispatchEvent(new Event('scrollend')));
  await expect(visible.getByRole('button',{name:'Instances',exact:true})).toHaveAttribute('aria-current','location');
});

test('a short final shelf fits above the floating dock in a narrow viewport',async({page})=>{
  await page.setViewportSize({width:320,height:640});
  await page.addInitScript(()=>localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:'en',homeShelves:['explore','instances']})));
  await page.goto('/');
  const dock=page.getByRole('navigation',{name:'Home sections'});
  await dock.getByRole('button',{name:'Instances',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>{
    const main=document.querySelector('main')!.getBoundingClientRect();
    const shelf=document.querySelector('[data-home-section="instances"]')!.getBoundingClientRect();
    return shelf.top>=main.top-1 && shelf.bottom<=main.bottom-88+1;
  })).toBe(true);
  await expect(dock.getByRole('button',{name:'Instances',exact:true})).toHaveAttribute('aria-current','location');
  await page.mouse.move(180,120);await page.mouse.wheel(0,-10000);
  await expect.poll(()=>page.locator('main').evaluate(node=>node.scrollTop)).toBe(0);
  await expect(dock.getByRole('button',{name:'Instances',exact:true})).not.toHaveAttribute('aria-current','location');
});

test('home navigation is accessible, respects reduced motion, and only scrolls its panel',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  const dock=page.getByRole('navigation',{name:'Home sections'});
  await dock.getByRole('button',{name:'Explore',exact:true}).click();
  await expect(dock.getByRole('button',{name:'Explore',exact:true})).toHaveAttribute('aria-current','location');
  expect(await page.evaluate(()=>window.scrollY)).toBe(0);
  await dock.getByRole('button',{name:'More',exact:true}).click();
  expect(await page.locator('.dock-reveal').evaluate(node=>getComputedStyle(node).transitionDuration)).toBe('0s');
  await page.keyboard.press('Escape');
  await expect(dock.getByRole('button',{name:'More',exact:true})).toBeFocused();
  const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations).toEqual([]);
  await page.setViewportSize({width:420,height:700});
  await dock.getByRole('button',{name:'More',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(420);
});


test('an entirely hidden home exposes a usable target for dragging a tool back',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{if(!localStorage.getItem('chest-ui-preferences-v1'))localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:'en',homeShelves:[]}));});
  await page.goto('/');
  const dock=page.getByRole('navigation',{name:'Home sections'});
  await expect(page.locator('.empty-chest')).toHaveAttribute('src','/chest.svg');
  await expect(page.locator('.empty-chest')).toHaveCSS('opacity','0.5');
  const more=dock.getByRole('button',{name:'More',exact:true});
  const frame=(await dock.boundingBox())!,button=(await more.boundingBox())!;
  expect(Math.abs(button.x+button.width/2-frame.x-frame.width/2)).toBeLessThan(1);
  await more.click();
  await expect(dock.locator('.hidden-tools')).toHaveCSS('border-left-width','0px');
  await expect(dock.locator('.hidden-tools')).toHaveCSS('padding-left','0px');
  const target=dock.getByRole('group',{name:'Visible sections'});
  await expect(dock.locator('.empty-drop')).toHaveCount(0);
  const from=(await dock.getByRole('button',{name:'Instances',exact:true}).boundingBox())!;
  await page.mouse.move(from.x+20,from.y+20);await page.mouse.down();
  await expect(dock.locator('.empty-drop')).toBeVisible();
  const to=(await target.boundingBox())!;
  expect(to.width).toBeGreaterThanOrEqual(40);expect(to.height).toBeGreaterThanOrEqual(40);
  await page.mouse.move(to.x+8,to.y+20,{steps:10});await page.mouse.up();
  await expect(dock.locator('.empty-drop')).toHaveCount(0);
  await expect(target.getByRole('button',{name:'Instances',exact:true})).toBeVisible();
  await expect(page.locator('[data-home-section="instances"]')).toBeVisible();
  await page.reload();await expect(page.locator('[data-home-section="instances"]')).toBeVisible();
});

test('dock toggle follows hidden shelves and minus target can hide a shelf when all are visible',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:'en',homeShelves:['instances','news','explore','worlds','servers','screenshots']})));
  await page.goto('/');
  const dock=page.getByRole('navigation',{name:'Home sections'});
  await expect(dock.locator('[data-home-more]')).toHaveCount(0);
  const first=(await dock.getByRole('button',{name:'Instances',exact:true}).boundingBox())!;
  await page.mouse.move(first.x+20,first.y+20);await page.mouse.down();
  const target=dock.getByRole('group',{name:'Hide shelf',exact:true});await expect(target).toHaveCount(0);
  await page.mouse.move(first.x+34,first.y+20);await expect(target).toBeVisible();
  const minus=(await target.boundingBox())!;await page.mouse.move(minus.x+minus.width/2,minus.y+minus.height/2,{steps:8});await page.mouse.up();
  await expect(page.locator('[data-home-section="instances"]')).toHaveCount(0);
  await expect(dock.locator('[data-home-more] .direction-icon')).toHaveAttribute('data-direction','left');
  await dock.getByRole('button',{name:'Collapse',exact:true}).click();
  await expect(dock.locator('[data-home-more] .direction-icon')).toHaveAttribute('data-direction','right');
});

test('dock context menu reorders, hides, restores and persists placement with corner orientation',async({page})=>{
  await page.goto('/');
  const dock=page.getByRole('navigation',{name:'Home sections'}),menu=page.getByRole('menu',{name:'Toolbar options'});
  await dock.getByRole('button',{name:'News',exact:true}).click({button:'right'});
  await expect(menu).toHaveClass(/instance-context-menu/);
  await expect(menu.getByRole('menuitem',{name:'Move up',exact:true})).toBeVisible();
  await menu.getByRole('menuitem',{name:'Move up',exact:true}).click();
  await expect(page.locator('[data-home-section]').first()).toHaveAttribute('data-home-section','news');
  await dock.getByRole('button',{name:'News',exact:true}).click({button:'right'});
  await expect(menu.getByRole('menuitem',{name:'Move up',exact:true})).toHaveCount(0);
  await menu.getByRole('menuitem',{name:'Hide News',exact:true}).click();
  await dock.getByRole('button',{name:'More',exact:true}).click();
  await dock.getByRole('button',{name:'News',exact:true}).click({button:'right'});
  await menu.getByRole('menuitem',{name:'Show News',exact:true}).click();
  await expect(page.locator('[data-home-section="news"]')).toHaveCount(1);
  await dock.getByRole('button',{name:'Instances',exact:true}).click({button:'right'});
  await expect(menu.getByRole('menuitemradio')).toHaveCount(0);
  await menu.getByRole('menuitem',{name:'Toolbar position',exact:true}).click();await menu.getByRole('menuitemradio',{name:'Middle right',exact:true}).click();
  await expect(dock).toHaveClass(/vertical/);
  await expect(dock).toHaveCSS('flex-direction','column');
  await dock.getByRole('button',{name:'Instances',exact:true}).click({button:'right'});
  await menu.getByRole('menuitem',{name:'Toolbar position',exact:true}).click();await menu.getByRole('menuitemradio',{name:'Top left',exact:true}).click();
  await dock.getByRole('button',{name:'Instances',exact:true}).click({button:'right'});
  await menu.getByRole('menuitem',{name:'Orientation',exact:true}).click();await menu.getByRole('menuitemradio',{name:'Vertical',exact:true}).click();
  await page.reload();await expect(page.locator('.home-dock-position')).toHaveAttribute('data-position','top-left');
  await expect(dock).toHaveClass(/vertical/);
  await dock.getByRole('button',{name:'Instances',exact:true}).focus();await page.keyboard.press('Shift+F10');
  await expect(menu).toBeVisible();await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);
  await dock.getByRole('button',{name:'More',exact:true}).click();await expect(dock.locator('[data-home-more] .direction-icon')).toHaveAttribute('data-direction','up');
  await expect.poll(()=>dock.evaluate(node=>node.getAnimations({subtree:true}).filter(animation=>animation.playState==='running').length)).toBe(0);
  const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations).toEqual([]);
});

test('all eight dock anchors stay on screen and vertical dragging previews the shelf order',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:'en',homeDockPosition:'middle-left'})));
  await page.goto('/');
  const dock=page.getByRole('navigation',{name:'Home sections'}),visible=dock.getByRole('group',{name:'Visible sections'});
  const start=(await visible.getByRole('button',{name:'Instances',exact:true}).boundingBox())!,end=(await visible.getByRole('button',{name:'Explore',exact:true}).boundingBox())!;
  await page.mouse.move(start.x+20,start.y+20);await page.mouse.down();await page.mouse.move(end.x+20,end.y+end.height-2,{steps:10});
  await expect(visible.getByRole('button').last()).toHaveAttribute('data-section','instances');
  await page.mouse.up();await expect(page.locator('[data-home-section]').last()).toHaveAttribute('data-home-section','instances');
  for(const name of ['Top left','Top center','Top right','Middle right','Bottom right','Bottom center','Bottom left','Middle left']){
    await dock.getByRole('button',{name:'Instances',exact:true}).click({button:'right'});
    const menu=page.getByRole('menu',{name:'Toolbar options'});
    if(name==='Top left')await menu.screenshot({path:'/tmp/chest-dock-menu.png'});
    await menu.getByRole('menuitem',{name:'Toolbar position',exact:true}).click();await menu.getByRole('menuitemradio',{name,exact:true}).click();
    const rect=(await dock.boundingBox())!;expect(rect.x).toBeGreaterThanOrEqual(64);expect(rect.y).toBeGreaterThanOrEqual(0);expect(rect.x+rect.width).toBeLessThanOrEqual(page.viewportSize()!.width);expect(rect.y+rect.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    await expect(dock).toHaveCSS('flex-direction',name.startsWith('Middle')?'column':'row');
  }
});

test('small pointer movement does not start reordering and hidden shelves reorder persistently',async({page})=>{
  await page.goto('/');const dock=page.getByRole('navigation',{name:'Home sections'});
  const instance=(await dock.getByRole('button',{name:'Instances',exact:true}).boundingBox())!;
  await page.mouse.move(instance.x+20,instance.y+20);await page.mouse.down();await page.mouse.move(instance.x+25,instance.y+20);
  await expect(page.locator('.dock-drag')).toHaveCount(0);await expect(dock.locator('.hide-target')).toHaveCount(0);await page.mouse.up();
  await expect(dock.getByRole('button',{name:'More',exact:true})).toHaveAttribute('aria-expanded','false');
  const current=(await dock.getByRole('button',{name:'Instances',exact:true}).boundingBox())!;
  await page.mouse.move(current.x+20,current.y+20);await page.mouse.down();await page.mouse.move(current.x+34,current.y+20);
  await expect(dock.getByRole('button',{name:'Collapse',exact:true})).toHaveAttribute('aria-expanded','true');
  await expect(dock.getByRole('button',{name:'Worlds',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await page.mouse.up();
  await expect.poll(()=>dock.evaluate(node=>node.getAnimations({subtree:true}).filter(animation=>animation.playState==='running').length)).toBe(0);
  const hidden=dock.getByRole('group',{name:'Hidden sections'});
  const from=(await hidden.getByRole('button',{name:'Worlds',exact:true}).boundingBox())!,to=(await hidden.getByRole('button',{name:'Screenshots',exact:true}).boundingBox())!;
  await page.mouse.move(from.x+20,from.y+20);await page.mouse.down();await page.mouse.move(to.x+to.width-2,to.y+20,{steps:10});
  await expect(hidden.getByRole('button').last()).toHaveAttribute('data-section','worlds');await page.mouse.up();
  await page.reload();await dock.getByRole('button',{name:'More',exact:true}).click();await expect(hidden.getByRole('button').last()).toHaveAttribute('data-section','worlds');
  await hidden.getByRole('button',{name:'Worlds',exact:true}).click({button:'right'});await page.getByRole('menu',{name:'Toolbar options'}).getByRole('menuitem',{name:'Move up',exact:true}).click();
  await dock.getByRole('button',{name:'More',exact:true}).click();await expect(hidden.getByRole('button').nth(1)).toHaveAttribute('data-section','worlds');
});

test('vertical buttons share a width and center their labels across both groups',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:'en',homeDockPosition:'middle-left'})));
  await page.goto('/');const dock=page.getByRole('navigation',{name:'Home sections'});await dock.getByRole('button',{name:'More',exact:true}).click();
  await expect.poll(()=>dock.evaluate(node=>node.getAnimations({subtree:true}).filter(animation=>animation.playState==='running').length)).toBe(0);
  const widths=await dock.locator('button[data-section]').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().width));
  expect(Math.max(...widths)-Math.min(...widths)).toBeLessThan(1);
  for(const button of await dock.locator('button[data-section]').all())await expect(button).toHaveCSS('justify-content','center');
});


for(const empty of ['visible','hidden'] as const){
  test(`vertical ${empty} drop target fills the toolbar and uses neutral gray styling`,async({page})=>{
    await page.addInitScript(empty=>localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:'en',homeDockPosition:'middle-right',homeShelves:empty==='visible'?[]:['instances','news','explore','worlds','servers','screenshots']})),empty);
    await page.goto('/');const dock=page.getByRole('navigation',{name:'Home sections'});
    if(empty==='visible'){await dock.getByRole('button',{name:'More',exact:true}).click();await expect.poll(()=>dock.evaluate(node=>node.getAnimations({subtree:true}).filter(animation=>animation.playState==='running').length)).toBe(0);}
    const source=(await dock.getByRole('button',{name:'Instances',exact:true}).boundingBox())!;
    await page.mouse.move(source.x+20,source.y+20);await page.mouse.down();
    const target=dock.locator(empty==='visible'?'.empty-visible':'.hide-target');
    if(empty==='hidden'){await expect(target).toHaveCount(0);await page.mouse.move(source.x+34,source.y+20);}
    await expect(target).toBeVisible();
    const area=(await target.boundingBox())!,group=(await dock.getByRole('group',{name:empty==='visible'?'Hidden sections':'Visible sections',exact:true}).boundingBox())!;
    expect(Math.abs(area.width-group.width)).toBeLessThan(1);
    await expect(target).toHaveCSS('color','rgb(176, 180, 184)');await expect(target).toHaveCSS('border-top-color','rgba(0, 0, 0, 0.533)');
    await page.keyboard.press('Escape');await page.mouse.up();
  });
}


test('orientation is always available and can override side and center placements',async({page})=>{
  await page.goto('/');const dock=page.getByRole('navigation',{name:'Home sections'}),menu=page.getByRole('menu',{name:'Toolbar options'});
  await dock.getByRole('button',{name:'Instances',exact:true}).click({button:'right'});
  await expect(menu.getByRole('menuitem',{name:'Hide Instances',exact:true})).toBeVisible();
  await menu.getByRole('menuitem',{name:'Orientation',exact:true}).click();await expect(menu.getByRole('menuitemradio',{name:'Vertical',exact:true})).toBeVisible();await menu.getByRole('menuitemradio',{name:'Vertical',exact:true}).click();
  await expect(dock).toHaveCSS('flex-direction','column');
  await dock.getByRole('button',{name:'Instances',exact:true}).click({button:'right'});await menu.getByRole('menuitem',{name:'Toolbar position',exact:true}).click();await menu.getByRole('menuitemradio',{name:'Middle right',exact:true}).click();
  await dock.getByRole('button',{name:'Instances',exact:true}).click({button:'right'});await menu.getByRole('menuitem',{name:'Orientation',exact:true}).click();await menu.getByRole('menuitemradio',{name:'Horizontal',exact:true}).click();await expect(dock).toHaveCSS('flex-direction','row');
  await page.reload();await expect(dock).toHaveCSS('flex-direction','row');
});


test('short clicks and slight movements do not reveal the minus area',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:'en',homeShelves:['instances','news','explore','worlds','servers','screenshots']})));
  await page.goto('/');const dock=page.getByRole('navigation',{name:'Home sections'}),item=dock.getByRole('button',{name:'Instances',exact:true});
  const rect=(await item.boundingBox())!;await page.mouse.move(rect.x+20,rect.y+20);await page.mouse.down();await expect(dock.locator('.hide-target')).toHaveCount(0);
  await page.mouse.move(rect.x+25,rect.y+20);await expect(dock.locator('.hide-target')).toHaveCount(0);await page.mouse.up();await expect(dock.locator('.hide-target')).toHaveCount(0);
});

for(const empty of ['visible','hidden'] as const){
  test(`holding a shelf reveals the empty ${empty} target without starting a reorder`,async({page})=>{
    await page.addInitScript(empty=>localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:'en',homeShelves:empty==='visible'?[]:['instances','news','explore','worlds','servers','screenshots']})),empty);
    await page.goto('/');const dock=page.getByRole('navigation',{name:'Home sections'});
    if(empty==='visible'){await dock.getByRole('button',{name:'More',exact:true}).click();await expect.poll(()=>dock.evaluate(node=>node.getAnimations({subtree:true}).filter(animation=>animation.playState==='running').length)).toBe(0);}
    const item=dock.getByRole('button',{name:'Instances',exact:true}),rect=(await item.boundingBox())!;
    await page.mouse.move(rect.x+20,rect.y+20);await page.mouse.down();
    const target=dock.locator(empty==='visible'?'.empty-visible':'.hide-target');
    await expect(target).toHaveCount(0);await expect(target).toBeVisible();
    await expect(page.locator('.dock-drag')).toHaveCount(0);
    await page.keyboard.press('Escape');await page.mouse.up();await expect(target).toHaveCount(0);
  });
}

test('toolbar submenus support keyboard return and stay inside a narrow viewport',async({page})=>{
  await page.setViewportSize({width:320,height:800});await page.goto('/');
  const dock=page.getByRole('navigation',{name:'Home sections'});
  await dock.getByRole('button',{name:'Instances',exact:true}).click({button:'right'});
  const main=page.getByRole('menu',{name:'Toolbar options',exact:true}),entry=main.getByRole('menuitem',{name:'Toolbar position',exact:true});
  await entry.focus();await page.keyboard.press('ArrowRight');
  const sub=page.getByRole('menu',{name:'Toolbar position',exact:true});await expect(sub).toBeVisible();
  const rect=(await sub.boundingBox())!;expect(rect.x).toBeGreaterThanOrEqual(0);expect(rect.x+rect.width).toBeLessThanOrEqual(320);
  await page.keyboard.press('Escape');await expect(sub).toHaveCount(0);await expect(entry).toBeFocused();await expect(main).toBeVisible();
  await page.keyboard.press('Escape');await expect(main).toHaveCount(0);
});

for(const vertical of [false,true]){
  test(`dock uses stable neutral drag previews with ${vertical?'vertical':'horizontal'} hidden tools`,async({page})=>{
    await page.addInitScript(vertical=>localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:'en',homeDockPosition:vertical?'middle-right':'bottom-center'})),vertical);
    await page.goto('/');
    const dock=page.getByRole('navigation',{name:'Home sections'});
    await dock.getByRole('button',{name:'More',exact:true}).click();
    await expect.poll(()=>dock.evaluate(node=>node.getAnimations({subtree:true}).filter(animation=>animation.playState==='running').length)).toBe(0);
    const hidden=dock.getByRole('group',{name:'Hidden sections'}),source=hidden.getByRole('button',{name:'Worlds',exact:true});
    const from=(await source.boundingBox())!,to=(await hidden.getByRole('button',{name:'Screenshots',exact:true}).boundingBox())!;
    const x=vertical?to.x+20:to.x+to.width-2,y=vertical?to.y+to.height-2:to.y+20;
    await page.mouse.move(from.x+20,from.y+20);await page.mouse.down();await page.mouse.move(x,y,{steps:10});
    await expect(hidden.getByRole('button').last()).toHaveAttribute('data-section','worlds');
    await expect(hidden.locator('.dragging')).toHaveCount(1);
    await expect(hidden).not.toHaveClass(/drop-hidden/);
    await expect(dock).toHaveCSS('--focus-ring','#b0b4b8');
    for(let i=0;i<4;i++)await page.mouse.move(x+(vertical?0:i%2),y+(vertical?i%2:0));
    await expect(hidden.getByRole('button').last()).toHaveAttribute('data-section','worlds');
    await page.keyboard.press('Escape');await page.mouse.up();
    await expect(hidden.getByRole('button').first()).toHaveAttribute('data-section','worlds');
  });
}

for(const orientation of ['horizontal','vertical'] as const){
  test(`bottom-right ${orientation} drag reveals the full hidden inventory and can hide the last shelf`,async({page},testInfo)=>{
    await page.addInitScript(orientation=>localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:'en',homeShelves:['screenshots'],homeDockPosition:'bottom-right',homeDockOrientation:orientation})),orientation);
    await page.goto('/');
    const dock=page.getByRole('navigation',{name:'Home sections'}),source=dock.getByRole('button',{name:'Screenshots',exact:true});
    await expect(dock).toBeVisible();
    await expect(source).toBeVisible();
    const from=(await source.boundingBox())!;
    await page.mouse.move(from.x+20,from.y+20);await page.mouse.down();await page.mouse.move(from.x+34,from.y+20);
    await expect(dock.getByRole('button',{name:'Collapse',exact:true})).toBeVisible();
    await expect.poll(()=>dock.evaluate(node=>node.getAnimations({subtree:true}).filter(animation=>animation.playState==='running').length)).toBe(0);
    const bounds=(await dock.boundingBox())!,viewport=page.viewportSize()!;
    expect(bounds.x).toBeGreaterThanOrEqual(64);expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x+bounds.width).toBeLessThanOrEqual(viewport.width);expect(bounds.y+bounds.height).toBeLessThanOrEqual(viewport.height);
    for(const item of await dock.locator('button[data-section]').all()){
      const box=(await item.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(bounds.x);expect(box.y).toBeGreaterThanOrEqual(bounds.y);
      expect(box.x+box.width).toBeLessThanOrEqual(bounds.x+bounds.width);expect(box.y+box.height).toBeLessThanOrEqual(bounds.y+bounds.height);
    }
    if(orientation==='vertical'){
      const widths=await dock.locator('button[data-section]').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().width));
      expect(Math.max(...widths)-Math.min(...widths)).toBeLessThan(1);
    }
    await page.screenshot({path:testInfo.outputPath('expanded-drag.png')});
    const hidden=dock.getByRole('group',{name:'Hidden sections'}),to=(await hidden.getByRole('button',{name:'Instances',exact:true}).boundingBox())!;
    await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:10});await page.mouse.up();
    await expect(dock.getByRole('group',{name:'Visible sections'}).getByRole('button')).toHaveCount(0);
    await expect(hidden.getByRole('button',{name:'Screenshots',exact:true})).toBeVisible();
    await expect(page.getByText('Your home is empty')).toBeVisible();
  });
}
test('vertical dock shares the widest visible label with every hidden button',async({page},testInfo)=>{
  await page.addInitScript(()=>localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:'en',homeShelves:['instances','screenshots','worlds'],homeDockPosition:'middle-right'})));
  await page.goto('/');
  const dock=page.getByRole('navigation',{name:'Home sections'});
  await dock.getByRole('button',{name:'More',exact:true}).click();
  await expect.poll(()=>dock.evaluate(node=>node.getAnimations({subtree:true}).filter(animation=>animation.playState==='running').length)).toBe(0);
  const widths=await dock.locator('button[data-section]').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().width));
  expect(Math.max(...widths)-Math.min(...widths)).toBeLessThan(1);
  await dock.screenshot({path:testInfo.outputPath('uniform-dock.png')});
});
