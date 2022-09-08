import { detach, insert, noop, SvelteComponent } from 'svelte/internal'

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
function createSlots(slots: any) {
	const svelteSlots: any = {}
	for (const slotName in slots) {
		svelteSlots[slotName] = [createSlotFn(slots[slotName])]
	}
	return svelteSlots
}

export function props(node, properties) {
	const applyProperties = () => {
		for (const [k, v] of Object.entries(properties)) {
			console.log(k, v)
			node[k] = v
		}
	}
	applyProperties()
	return {
		update(updatedProperties) {
			properties = updatedProperties
			applyProperties()
		},
	}
}

export function register(
	tagName: string,
	Component: SvelteComponent,
	css: CSSStyleSheet[] | string,
	dynamicAttributes: string[] = [],
	props: string[] = [],
): HTMLElement {
	class SvelteElement extends HTMLElement {
		componentInstance!: SvelteComponent

		static get observedAttributes() {
			return dynamicAttributes
		}

		constructor() {
			super()
			console.log('THIS', this)
			// for (const prop of props) {
			//   Object.defineProperty(this, prop, {
			//     get: function () {
			//       return this['_' + prop]
			//     },
			//     set: function (x) {
			//       console.log("setter", prop, x)
			//       this['_' + prop] = x
			//       if (this.componentInstance) this.componentInstance[prop] = x
			//     },
			//   })
			// }

			this.attachShadow({ mode: 'open' })
			if (this.shadowRoot == undefined) throw new Error('attachShadow is not supported')

			if (typeof css === 'string') {
				const rootStyle = document.createElement('style')
				rootStyle.textContent = css
				this.shadowRoot.append(rootStyle)
			} else {
				throw new TypeError('adoptedStyleSheets is not supported')
				// this.shadowRoot.adoptedStyleSheets = css
			}
		}

		connectedCallback() {
			// setTimeout(() => {
			const svelteProps = {}
			for (const prop of props) {
				console.log('setting connect', prop, this[prop])
				svelteProps[prop] = this[prop]
			}
			console.group('props')
			console.log(svelteProps, props)
			console.groupEnd()
			const customPropsObject = {
				$$scope: {},
				$$slots: createSlots(this.getShadowSlots()),
				...svelteProps,
			}
			console.group('attributes')
			console.log(this.attributes)
			console.groupEnd()
			for (const attr of this.attributes) {
				customPropsObject[attr.name] = attr.value
			}
			console.log('customProps', customPropsObject)
			this.componentInstance = new Component({
				target: this.shadowRoot,
				props: customPropsObject,
			})
			// }, 1)
		}

		disconnectedCallback() {
			try {
				this.componentInstance.$destroy()
			} catch (error) {
				console.info(error)
			}
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

			// eslint-disable-next-line unicorn/no-array-for-each
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

	// customElements.whenDefined(tagName).then((res) => {
	//   if (res) return
	//   customElements.define(tagName, SvelteElement)
	// })
	customElements.define(tagName, SvelteElement)

	// return new instance of SvelteElement
	return new SvelteElement()
}
