// Build-time geometry only: exported SVGs need no JavaScript to render.
export function hexagonPoints(cx=64,cy=64,radius=52){
  return Array.from({length:6},(_,i)=>{const angle=(-90+i*60)*Math.PI/180;return [cx+radius*Math.cos(angle),cy+radius*Math.sin(angle)];});
}
const number=value=>String(Number(value.toFixed(6)));
const point=([x,y])=>`${number(x)} ${number(y)}`;
const polygon=points=>`M${points.map(point).join(' ')}Z`;
export function chestMark(){
  const vertices=hexagonPoints(),center=[64,64];
  const top=[vertices[0],vertices[1],center,vertices[5]];
  const right=[center,vertices[1],vertices[2],vertices[3]];
  // Latch dimensions use the same 30-degree isometric axes as the cube faces.
  const x=81,y=69,axis=Math.sqrt(3)/2,length=12,depth=4,height=18;
  const a=[x,y],b=[x+length*axis,y-length/2],c=[b[0]+depth*axis,b[1]+depth/2],d=[x+depth*axis,y+depth/2];
  const lower=p=>[p[0],p[1]+height],pivot=[x+8*axis,y+7];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <title>Chest</title>
  <desc>A regular hexagonal chest with a lit top, shaded right face, softly lit outline junction, and silver latch.</desc>
  <defs>
    <linearGradient id="wood" x1="64" y1="12" x2="64" y2="116" gradientUnits="userSpaceOnUse">
      <stop stop-color="#AF8851"/>
      <stop offset=".5" stop-color="#967044"/>
      <stop offset="1" stop-color="#79552F"/>
    </linearGradient>
    <linearGradient id="top-light" x1="64" y1="12" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFF0CE" stop-opacity=".16"/>
      <stop offset="1" stop-color="#FFF0CE" stop-opacity=".06"/>
    </linearGradient>
    <linearGradient id="right-shade" x1="64" y1="38" x2="109.033321" y2="116" gradientUnits="userSpaceOnUse">
      <stop stop-color="#191613" stop-opacity=".12"/>
      <stop offset="1" stop-color="#191613" stop-opacity=".25"/>
    </linearGradient>
    <radialGradient id="outline-light" cx="${number(center[0])}" cy="${number(center[1])}" r="42" gradientUnits="userSpaceOnUse">
      <stop stop-color="#615544"/>
      <stop offset=".4" stop-color="#40392F"/>
      <stop offset="1" stop-color="#25221F"/>
    </radialGradient>
    <linearGradient id="silver" x1="84" y1="71" x2="94" y2="83" gradientUnits="userSpaceOnUse">
      <stop stop-color="#CDD1CF"/>
      <stop offset="1" stop-color="#AFB7B3"/>
    </linearGradient>
    <filter id="halo" x="-100%" y="-70%" width="300%" height="240%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="0" stdDeviation="1.8" flood-color="#E0E8D9" flood-opacity=".22"/>
    </filter>
  </defs>
  <path fill="url(#wood)" d="${polygon(vertices)}"/>
  <path fill="url(#top-light)" d="${polygon(top)}"/>
  <path fill="url(#right-shade)" d="${polygon(right)}"/>
  <g fill="none" stroke="url(#outline-light)" stroke-width="7" stroke-linejoin="miter" stroke-linecap="butt">
    <path d="${polygon(vertices)}"/>
    <path d="M${point(vertices[5])} ${point(center)} ${point(vertices[1])}M${point(center)}V${number(vertices[3][1])}M${point([vertices[5][0],vertices[5][1]+20])} ${point([64,84])} ${point([vertices[1][0],vertices[1][1]+20])}"/>
  </g>
  <g filter="url(#halo)" transform="translate(${point(pivot)}) matrix(${number(2/3)} ${number(1/(3*Math.sqrt(3)))} 0 1 0 0) translate(${point(pivot.map(v=>-v))})">
    <path fill="#77817D" d="${polygon([a,b,c,lower(c),lower(d),lower(a)])}"/>
    <path fill="url(#silver)" d="${polygon([d,c,lower(c),lower(d)])}"/>
    <path fill="#DFE3DD" d="${polygon([a,b,c,d])}"/>
  </g>
</svg>
`;
}
