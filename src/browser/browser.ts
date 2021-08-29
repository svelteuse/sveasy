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
  dynamicAttributes: String[] = [],
  props: String[] = []
): HTMLElement {
  class SvelteElement extends HTMLElement {
    static get observedAttributes() {
      return props
    }

    constructor() {
      super()
      // console.log('construct', this)

      for (const prop of props) {
        this[prop] = undefined
      }

      this.attachShadow({ mode: 'open' })
      const rootStyle = document.createElement('style')
      rootStyle.textContent = css.slice(1, -1)
      this.shadowRoot.appendChild(rootStyle)
      // this.target = this.attachShadow({ mode: 'open' })
      // const style = document.createElement('style')
      // style.textContent = css.slice(1, -1)
      // this.target.append(style)

      // this.slotcount = 0
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
        console.log(svelteProps)
        this.componentInstance = new Component({
          target: this.shadowRoot,
          props: {
            $$scope: {},
            $$slots: createSlots(this.getShadowSlots()),
            ...svelteProps,
            ...this.attributes,
          },
        })

        // const props: any = {}
        // let slots
        // props.$$scope = {}
        // Array.from(this.attributes).forEach((attr) => {
        //   props[attr.name] = attr.value
        // })
        // slots = this.getShadowSlots()
        // this.slotcount = Object.keys(slots).length
        // props.$$slots = createSlots(slots)
        // this.instance = new Component({
        //   target: this.target,
        //   props,
        // })
      }, 1)
    }

    disconnectedCallback() {
      try {
        this.componentInstance.$destroy()
      } catch (error) {
        console.log(error)
      }
    }

    attributeChangedCallback(attrName: string, oldVal: string, newVal: string) {
      console.log(attrName, oldVal, '->', newVal)
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
