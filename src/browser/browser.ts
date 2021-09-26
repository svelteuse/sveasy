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
  css: CSSStyleSheet[] | string,
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
        Object.defineProperty(this, prop, {
          get: function () {
            return this['_' + prop]
          },
          set: function (x) {
            this['_' + prop] = x
            if (this.componentInstance) this.componentInstance[prop] = x
          },
        })
      }

      this.attachShadow({ mode: 'open' })
      if (typeof css === 'string') {
        const rootStyle = document.createElement('style')
        rootStyle.textContent = css.slice(1, -1)
        this.shadowRoot.appendChild(rootStyle)
      } else {
        this.shadowRoot.adoptedStyleSheets = css
      }
    }

    connectedCallback() {
      setTimeout(() => {
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
