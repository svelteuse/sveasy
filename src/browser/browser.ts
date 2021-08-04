// @ts-nocheck

import { detach, insert, noop } from 'svelte/internal'
function createSlots(slots: any) {
  const svelteSlots: any = {}
  for (const slotName in slots) {
    svelteSlots[slotName] = [createSlotFn(slots[slotName])]
  }
  // eslint-disable-next-line
  function createSlotFn(element: any) {
    return function () {
      return {
        c: noop,
        m: function mount(target: any, anchor: any) {
          insert(target, element.cloneNode(true), anchor)
        },
        d: function destroy(detaching: any) {
          if (detaching && element.innerHTML) {
            detach(element)
          }
        },
        l: noop,
      }
    }
  }
  return svelteSlots
}

export function register(
  tagName: string,
  Component: any,
  css: string,
  props: any = []
): HTMLElement {
  class SvelteElement extends HTMLElement {
    static get observedAttributes() {
      return props
    }

    constructor() {
      super()
      this.slotcount = 0

      this.target = this.attachShadow({ mode: 'open' })
      const style = document.createElement('style')
      style.textContent = css.slice(1, -1)
      this.target.append(style)
    }

    connectedCallback() {
      const props: any = {}
      let slots
      props.$$scope = {}
      // eslint-disable-next-line
      Array.from(this.attributes).forEach((attr) => {
        props[attr.name] = attr.value
      })
      props.$$scope = {}
      // eslint-disable-next-line
      slots = this.getShadowSlots()
      props.$$scope = {}
      this.slotcount = Object.keys(slots).length
      props.$$slots = createSlots(slots)
      this.instance = new Component({
        target: this.target,
        props,
      })
    }

    disconnectedCallback() {
      try {
        this.instance.destroy()
        this.instance = undefined
      } catch (error) {
        console.log(error)
      }
    }

    attributeChangedCallback(attrName: string, oldVal: string, newVal: string) {
      console.log(attrName, oldVal, '->', newVal)
      console.log(this.instance)
      if (this.instance && newVal !== oldVal) {
        this.instance[attrName] = newVal
      }
    }

    getShadowSlots() {
      const namedSlots = this.querySelectorAll('[slot]')
      const slots: any = {}
      let htmlLength = this.innerHTML.length
      // eslint-disable-next-line
      namedSlots.forEach((n) => {
        slots[n.slot] = document.createElement('slot')
        slots[n.slot].setAttribute('name', n.slot)
        htmlLength -= n.outerHTML.length
      })
      if (htmlLength > 0) {
        slots.default = document.createElement('slot')
      }
      return slots
    }
  }

  customElements.define(tagName, SvelteElement)
  return new SvelteElement()
}
