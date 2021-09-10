// @ts-nocheck
import { detach, insert, noop, SvelteComponent } from 'svelte/internal'
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
  dynamicAttributes: String[] = [],
  props: String[] = []
): HTMLElement {
  class SvelteElement extends HTMLElement {
    static get observedAttributes() {
      return dynamicAttributes
    }

    constructor() {
      super()

      for (const prop of props) {
        this[prop] = undefined
      }

      this.attachShadow({ mode: 'open' })
      const rootStyle = document.createElement('style')
      rootStyle.textContent = css.slice(1, -1)
      this.shadowRoot.appendChild(rootStyle)
    }

    connectedCallback() {
      setTimeout(() => {
        for (const prop of props) {
          if (this.hasOwnProperty(prop)) {
            let value = this[prop]
            delete this[prop]
            this[prop] = value
          }
        }

        let svelteProps = {}
        for (const prop of props) {
          svelteProps[prop] = this[prop]
        }
        let customPropsObject = {
          $$scope: {},
          $$slots: createSlots(this.getShadowSlots()),
          ...svelteProps,
        }
        Array.from(this.attributes).forEach((attr) => {
          customPropsObject[attr.name] = attr.value
        })

        this.componentInstance = new Component({
          target: this.shadowRoot,
          props: customPropsObject,
        })
      }, 1)
    }

    disconnectedCallback() {
      if (this.componentInstance) this.componentInstance.$destroy()
    }

    attributeChangedCallback(attrName: string, oldVal: string, newVal: string) {
      if (this.componentInstance && newVal !== oldVal) {
        this.componentInstance[attrName] = newVal
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
