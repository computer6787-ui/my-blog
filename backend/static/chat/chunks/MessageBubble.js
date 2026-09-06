import"./rolldown-runtime.js";import{C as e,T as t,_ as n,a as r,b as i,h as a,m as o,o as s,s as c,v as l,x as u}from"./vendor-react.js";t();var d=e(),f=[`from-blossom-500 to-blossom-600`,`from-pink-500 to-rose-600`,`from-blossom-500 to-cyan-600`,`from-emerald-500 to-teal-600`,`from-amber-500 to-orange-600`,`from-blossom-500 to-fuchsia-600`];function p(e){let t=(e||`Guest`).trim(),n=t?t[0].toUpperCase():`G`,r=0;for(let e=0;e<t.length;e++)r=t.charCodeAt(e)+((r<<5)-r);return{initial:n,gradient:f[Math.abs(r)%f.length]}}var m=({name:e,avatarUrl:t,size:n=`md`,isOnline:r=!1,showStatus:i=!1})=>{let{initial:a,gradient:o}=p(e),s={xs:`w-6 h-6 text-xs`,sm:`w-8 h-8 text-xs font-semibold`,md:`w-10 h-10 text-sm font-bold`,lg:`w-12 h-12 text-base font-bold`,xl:`w-16 h-16 text-lg font-bold`}[n],c={xs:`w-2 h-2 bottom-0 right-0`,sm:`w-2.5 h-2.5 bottom-0 right-0`,md:`w-3 h-3 bottom-0.5 right-0.5`,lg:`w-3.5 h-3.5 bottom-0.5 right-0.5`,xl:`w-4 h-4 bottom-1 right-1`}[n];return(0,d.jsxs)(`div`,{className:`relative inline-flex flex-shrink-0 items-center justify-center ${s}`,children:[t?(0,d.jsx)(`img`,{src:t,alt:e||`User Avatar`,className:`w-full h-full rounded-full object-cover shadow-inner ring-1 ring-black/5 dark:ring-white/10`,onError:e=>{e.currentTarget.style.display=`none`}}):(0,d.jsx)(`div`,{className:`w-full h-full rounded-full bg-gradient-to-br ${o} text-white flex items-center justify-center shadow-inner select-none`,children:a}),i&&(0,d.jsx)(`span`,{className:`absolute rounded-full ring-2 ring-white dark:ring-slate-900 ${c} ${r?`bg-emerald-500 live-pulse-dot`:`bg-slate-400 dark:bg-slate-600`}`,title:r?`Online now`:`Offline`})]})},h=({role:e,size:t=`sm`})=>{let n=(e||`guest`).toLowerCase();return n===`admin`?(0,d.jsxs)(`span`,{className:`inline-flex items-center gap-1 font-semibold rounded-full uppercase tracking-wider ${t===`sm`?`px-1.5 py-0.5 text-[10px]`:`px-2 py-0.5 text-xs`} bg-gradient-to-r from-blossom-600 to-blossom-600 text-white shadow-sm`,title:`Lumora Administrator`,children:[(0,d.jsx)(c,{className:`w-2.5 h-2.5`}),`Admin`]}):n===`moderator`||n===`mod`?(0,d.jsxs)(`span`,{className:`inline-flex items-center gap-1 font-semibold rounded-full uppercase tracking-wider ${t===`sm`?`px-1.5 py-0.5 text-[10px]`:`px-2 py-0.5 text-xs`} bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30`,title:`Community Moderator`,children:[(0,d.jsx)(s,{className:`w-2.5 h-2.5`}),`Mod`]}):n===`user`||n===`member`||n===`author`?(0,d.jsx)(`span`,{className:`inline-flex items-center gap-1 font-medium rounded-full ${t===`sm`?`px-1.5 py-0.5 text-[10px]`:`px-2 py-0.5 text-xs`} bg-blossom-50 dark:bg-blossom-950/50 text-blossom-600 dark:text-blossom-400 border border-blossom-200/50 dark:border-blossom-800/40`,children:`Member`}):(0,d.jsxs)(`span`,{className:`inline-flex items-center gap-1 font-medium rounded-full ${t===`sm`?`px-1.5 py-0.5 text-[10px]`:`px-2 py-0.5 text-xs`} bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400`,children:[(0,d.jsx)(r,{className:`w-2.5 h-2.5`}),`Guest`]})};function g(e){try{return new Date(e).toLocaleTimeString([],{hour:`2-digit`,minute:`2-digit`})}catch{return``}}var _=({authorName:e,authorRole:t,authorAvatar:r,messageBody:s,createdAt:c,isSelf:f,isRead:p,showAvatar:_=!0,showRole:b=!0,onAuthorClick:x})=>{let S=g(c),C=(e,t)=>(0,d.jsxs)(`div`,{className:`mt-1 overflow-hidden rounded-xl border border-black/10 dark:border-white/10 shadow-sm max-w-xs`,children:[(0,d.jsx)(`img`,{src:e,alt:t,className:`block w-full max-h-60 object-cover cursor-pointer hover:opacity-95 transition-opacity`,onClick:()=>window.open(e,`_blank`),onError:e=>{let t=e.currentTarget;t.style.display=`none`;let n=t.nextElementSibling;n&&(n.style.display=`flex`)}}),(0,d.jsxs)(`div`,{className:`hidden items-center gap-2.5 px-4 py-3 text-xs text-slate-500 dark:text-slate-400 bg-black/5 dark:bg-white/5`,"aria-hidden":`true`,children:[(0,d.jsx)(o,{className:`w-4 h-4 flex-shrink-0`}),(0,d.jsx)(`span`,{className:`truncate`,children:`This image is no longer available`})]})]});return(0,d.jsxs)(`div`,{className:`
        group
        flex
        items-end
        gap-2.5
        mb-3.5
        transition-all
        min-w-0
        w-full
        ${f?`flex-row-reverse`:`flex-row`}
      `,children:[_&&!f&&(0,d.jsx)(`div`,{onClick:x,className:x?`cursor-pointer hover:opacity-85 transition-opacity flex-shrink-0`:`flex-shrink-0`,title:x?`Direct message ${e||`user`}`:void 0,children:(0,d.jsx)(m,{name:e,avatarUrl:r,size:`sm`})}),(0,d.jsxs)(`div`,{className:`
          min-w-0
          max-w-[75%]
          flex
          flex-col
          ${f?`items-end`:`items-start`}
        `,children:[!f&&e&&(0,d.jsxs)(`div`,{className:`flex items-center gap-1.5 mb-1 px-1 max-w-full`,children:[(0,d.jsx)(`span`,{onClick:x,className:`
                text-xs
                font-semibold
                text-slate-700
                dark:text-slate-300
                truncate
                ${x?`cursor-pointer hover:text-blossom-600 dark:hover:text-blossom-400 transition-colors`:``}
              `,children:e}),b&&(0,d.jsx)(h,{role:t,size:`sm`})]}),(0,d.jsxs)(`div`,{className:`
            relative
            w-fit
            max-w-full
            min-w-[120px]
            px-4
            py-3.5
            rounded-xl
            text-sm
            shadow-sm
            break-words
            ${f?`bg-blossom-600 text-white rounded-br-md`:`bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-md`}
          `,children:[(()=>{let e=s.trim(),t=e.match(/^!\[(.*?)\]\((.*?)\)$/);if(t){let e=t[1],n=t[2];return C(n,e||`Image`)}if(v.test(e)&&e.split(/\s+/).length===1)return C(e,`Attachment`);if(e.startsWith(`/static/uploads/chat/`)||e.includes(`/storage/v1/object/public/`)){let t=e.split(`/`).pop()?.replace(/^[a-f0-9]{12}_/,``)||`Attachment`;return/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(e)?C(e,t):(0,d.jsxs)(`a`,{href:e,target:`_blank`,rel:`noopener noreferrer`,className:`flex items-center gap-2.5 p-2 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 transition-colors text-xs font-medium max-w-full`,children:[(0,d.jsx)(a,{className:`w-4 h-4 text-blossom-500 flex-shrink-0`}),(0,d.jsx)(`span`,{className:`truncate max-w-[140px]`,children:t}),(0,d.jsx)(l,{className:`w-3.5 h-3.5 ml-auto opacity-70 flex-shrink-0`})]})}let r=s.split(y);return(0,d.jsx)(`p`,{className:`
          m-0
          min-w-0
          max-w-full
          text-sm
          leading-relaxed
          whitespace-pre-wrap
          break-words
        `,style:{overflowWrap:`anywhere`,wordBreak:`break-word`},children:r.map((e,t)=>y.test(e)?(y.lastIndex=0,(0,d.jsxs)(`a`,{href:e,target:`_blank`,rel:`noopener noreferrer`,className:`
                  underline
                  inline-flex
                  items-center
                  gap-0.5
                  font-medium
                  hover:opacity-80
                  break-all
                  max-w-full
                `,children:[(0,d.jsx)(`span`,{className:`break-all`,children:e}),(0,d.jsx)(n,{className:`w-2.5 h-2.5 inline flex-shrink-0`})]},t)):(y.lastIndex=0,e))})})(),(0,d.jsxs)(`div`,{className:`
              flex
              items-center
              justify-end
              gap-1
              mt-1.5
              text-[10px]
              select-none
              whitespace-nowrap
              ${f?`text-white/75`:`text-slate-400 dark:text-slate-500`}
            `,children:[(0,d.jsx)(`span`,{children:S}),f&&typeof p==`boolean`&&(0,d.jsx)(`span`,{title:p?`Seen`:`Delivered`,className:`flex-shrink-0`,children:p?(0,d.jsx)(u,{className:`w-3.5 h-3.5 text-white/90`}):(0,d.jsx)(i,{className:`w-3.5 h-3.5 text-white/70`})})]})]})]})]})},v=/https?:\/\/[^\s]+?\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?[^\s]*)?/i,y=/https?:\/\/[^\s]+/g;export{h as n,m as r,_ as t};