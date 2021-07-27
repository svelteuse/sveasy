import { detach, insert, noop } from 'svelte/internal';
function createSlots(slots: any) {
  const svelteSlots: any = {};
  for (const slotName in slots) {
    svelteSlots[slotName] = [createSlotFn(slots[slotName])];
  }
  function createSlotFn(element: any) {
    return function() {
      return {
        c: noop,
        m: function mount(target: any, anchor: any ) {
          insert(target, element.cloneNode(true), anchor); 
        },
        d: function destroy(detaching: any) { 
          if (detaching && element.innerHTML){ 
            detach(element);
          } 
        },
        l: noop,
      };
    }
  }
  return svelteSlots;
}

export function register(tagName: string, Component: any, css: string, props = []): HTMLElement {
  class SvelteElement extends HTMLElement {
    target: ShadowRoot;
    instance: any;
    slotcount: number;
    constructor() {
      super();
      this.slotcount = 0
      
      this.target = this.attachShadow({ mode: 'open' })
      let style = document.createElement('style');
      style.innerHTML = css
      // console.log(style);
      this.target.appendChild(style)
    }

    connectedCallback() {
      let props: any = {}
      let slots
      props.$$scope = {}
      Array.from(this.attributes).forEach(attr => {props[attr.name] = attr.value})
      props.$$scope = {}
      slots = this.getShadowSlots()
      props.$$scope = {}
      this.slotcount = Object.keys(slots).length
      props.$$slots = createSlots(slots)
      
      this.instance = new Component({ 
        target: this.target,
        props
      })

    }
    
    detachedCallback() {
      try {
        this.instance.destroy()
        this.instance = null
      } catch (e) {
        console.log(e)
      }
    }

    getShadowSlots(){
      const namedSlots = this.querySelectorAll('[slot]')
      let slots: any = {}
      let htmlLength = this.innerHTML.length
      namedSlots.forEach(n=>{
        slots[n.slot] = document.createElement("slot")
        slots[n.slot].setAttribute("name",n.slot)
        htmlLength-=n.outerHTML.length
      })
      if(htmlLength>0){
        slots.default = document.createElement("slot")
      }
      return slots
    }

    attributeChangedCallback(attrName: string, oldVal: string, newVal: string) {
      if (this.instance && newVal !== oldVal) {
        this.instance.set({ [ attrName ]: newVal })
      }
    }
  }

  customElements.define(tagName, SvelteElement)
  return new SvelteElement
}