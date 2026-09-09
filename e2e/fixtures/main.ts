import { resizable, sortable } from '../../src/index';

const tall = document.querySelector('#tall-list')!;
for (let i = 0; i < 20; i++) {
  const li = document.createElement('li');
  li.dataset.id = `t${i}`;
  li.textContent = `t${i}`;
  tall.appendChild(li);
}

const shadow = document.querySelector('#shadow-host')!.attachShadow({ mode: 'open' });
const shadowList = document.createElement('ul');
shadowList.id = 'shadow-list';
shadowList.style.cssText = 'margin:0;padding:0;list-style:none';
for (const id of ['a', 'b', 'c']) {
  const li = document.createElement('li');
  li.dataset.id = id;
  li.tabIndex = 0;
  li.textContent = id;
  li.style.cssText = 'height:48px;border:1px solid #ccc';
  shadowList.appendChild(li);
}
shadow.appendChild(shadowList);

const common = { distance: 0, animation: 0 } as const;
sortable(document.querySelector<HTMLElement>('#plain')!, common);
sortable(document.querySelector<HTMLElement>('#scaled-list')!, common);
sortable(document.querySelector<HTMLElement>('#rtl')!, common);
sortable(document.querySelector<HTMLElement>('#tall-list')!, common);
sortable(shadowList, common);
resizable(document.querySelector<HTMLElement>('#box')!, { handles: ['se'], distance: 0 });

(window as unknown as { detentReady: boolean }).detentReady = true;
