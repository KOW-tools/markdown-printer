import { ref, watch, nextTick, type Ref } from 'vue'
import { PAGE_SIZES } from '../utils/constants'
import { fontFamilyCSS } from '../utils/css'

export interface Page {
  index: number
  elements: string[]
}

const MM_TO_PX = 96 / 25.4

export function usePagination(
  html: Ref<string>,
  pageHeight: Ref<number>,
  scale: Ref<number>,
  pageSize: Ref<string>,
  margin: Ref<{ top: string; right: string; bottom: string; left: string }>,
  font: Ref<string>,
  fontSize: Ref<number>,
) {
  const pages = ref<Page[]>([{ index: 0, elements: [] }])
  const totalPages = ref(1)

  let measureContainer: HTMLElement | null = null

  function getMeasureContainer(): HTMLElement {
    if (!measureContainer) {
      measureContainer = document.createElement('div')
      measureContainer.style.cssText =
        'position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;'
      document.body.appendChild(measureContainer)
    }
    return measureContainer
  }

  function parseMarginValue(val: string): number {
    if (val.endsWith('mm')) return parseFloat(val) * MM_TO_PX
    if (val.endsWith('in')) return parseFloat(val) * 96
    if (val.endsWith('px')) return parseFloat(val)
    return parseFloat(val) || 0
  }

  function getElementHeight(el: HTMLElement): number {
    const rect = el.getBoundingClientRect()
    const style = window.getComputedStyle(el)
    const marginTop = parseFloat(style.marginTop) || 0
    const marginBottom = parseFloat(style.marginBottom) || 0
    return rect.height + marginTop + marginBottom
  }

  function waitForImages(container: HTMLElement): Promise<void> {
    const images = Array.from(container.querySelectorAll('img'))
    const pending = images.filter(img => !img.complete)
    if (pending.length === 0) return Promise.resolve()
    return Promise.all(
      pending.map(img =>
        new Promise<void>(resolve => {
          img.onload = () => resolve()
          img.onerror = () => resolve()
        })
      )
    ).then(() => {})
  }

  function splitTable(tableEl: HTMLElement, maxHeight: number, contentWidth: number, fontCSS: string, fontSizePx: number): string[] {
    const thead = tableEl.querySelector('thead')
    const theadHtml = thead ? thead.outerHTML : ''
    const tbody = tableEl.querySelector('tbody')
    const rows = tbody
      ? Array.from(tbody.querySelectorAll(':scope > tr'))
      : Array.from(tableEl.querySelectorAll(':scope > tr'))
    const tableAttrs = Array.from(tableEl.attributes)
      .map(a => ` ${a.name}="${a.value}"`)
      .join('')

    if (rows.length === 0) return [tableEl.outerHTML]

    const measureDiv = document.createElement('div')
    measureDiv.style.cssText =
      'position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;'
    document.body.appendChild(measureDiv)

    const wrapper = document.createElement('div')
    wrapper.className = 'markdown-body'
    wrapper.style.width = `${contentWidth}px`
    wrapper.style.fontFamily = fontCSS
    wrapper.style.fontSize = `${fontSizePx}px`
    wrapper.style.lineHeight = '1.5'
    measureDiv.appendChild(wrapper)

    const chunks: string[] = []
    let chunkRows: Element[] = []

    function buildTable(rows: Element[]): string {
      const tbodyHtml = rows.length > 0
        ? `<tbody>${rows.map(r => r.outerHTML).join('')}</tbody>`
        : ''
      return `<table${tableAttrs}>${theadHtml}${tbodyHtml}</table>`
    }

    function measureChunk(rows: Element[]): number {
      wrapper.innerHTML = buildTable(rows)
      const table = wrapper.firstElementChild as HTMLElement
      if (!table) return 0
      table.style.display = 'table'
      table.style.width = '100%'
      table.style.tableLayout = 'fixed'
      return getElementHeight(table)
    }

    for (const row of rows) {
      chunkRows.push(row)
      if (measureChunk(chunkRows) > maxHeight && chunkRows.length > 1) {
        chunkRows.pop()
        chunks.push(buildTable(chunkRows))
        chunkRows = [row]
      }
    }
    if (chunkRows.length > 0) chunks.push(buildTable(chunkRows))

    document.body.removeChild(measureDiv)
    return chunks
  }

  function splitList(listEl: HTMLElement, firstPageHeight: number, fullPageHeight: number, contentWidth: number, fontCSS: string, fontSizePx: number): string[] {
    const tagName = listEl.tagName
    const isOrdered = tagName === 'OL'
    const isReversed = isOrdered && listEl.hasAttribute('reversed')
    const items = Array.from(listEl.querySelectorAll(':scope > li'))

    if (items.length === 0) return [listEl.outerHTML]

    let baseStart = 1
    if (isOrdered) {
      const existingStart = listEl.getAttribute('start')
      if (existingStart !== null) {
        baseStart = parseInt(existingStart)
      } else if (isReversed) {
        baseStart = items.length
      }
    }

    const measureDiv = document.createElement('div')
    measureDiv.style.cssText =
      'position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;'
    document.body.appendChild(measureDiv)

    const wrapper = document.createElement('div')
    wrapper.className = 'markdown-body'
    wrapper.style.width = `${contentWidth}px`
    wrapper.style.fontFamily = fontCSS
    wrapper.style.fontSize = `${fontSizePx}px`
    wrapper.style.lineHeight = '1.5'
    measureDiv.appendChild(wrapper)

    const chunks: string[] = []
    let chunkItems: Element[] = []

    function buildList(items: Element[], globalStartIndex: number): string {
      let attrs = ''
      for (const attr of listEl.attributes) {
        if (attr.name === 'start') continue
        attrs += ` ${attr.name}="${attr.value}"`
      }

      if (isOrdered) {
        const startValue = isReversed
          ? baseStart - globalStartIndex
          : baseStart + globalStartIndex
        attrs += ` start="${startValue}"`
      }

      const itemsHtml = items.map(r => r.outerHTML).join('')
      return `<${tagName.toLowerCase()}${attrs}>${itemsHtml}</${tagName.toLowerCase()}>`
    }

    function measureChunk(items: Element[]): number {
      wrapper.innerHTML = buildList(items, 0)
      const list = wrapper.firstElementChild as HTMLElement
      if (!list) return 0
      return getElementHeight(list)
    }

    let chunkStartIndex = 0
    let currentMaxHeight = firstPageHeight
    for (let i = 0; i < items.length; i++) {
      chunkItems.push(items[i])
      if (measureChunk(chunkItems) > currentMaxHeight && chunkItems.length > 1) {
        chunkItems.pop()
        chunks.push(buildList(chunkItems, chunkStartIndex))
        chunkStartIndex = i
        chunkItems = [items[i]]
        currentMaxHeight = fullPageHeight
      }
    }
    if (chunkItems.length > 0) {
      chunks.push(buildList(chunkItems, chunkStartIndex))
    }

    document.body.removeChild(measureDiv)
    return chunks
  }

  async function splitIntoPages() {
    const container = getMeasureContainer()

    const size = PAGE_SIZES.find(p => p.name === pageSize.value) || PAGE_SIZES[0]
    const widthMm = parseFloat(size.width)
    const pageWidthPx = widthMm * MM_TO_PX

    const padTop = parseMarginValue(margin.value.top)
    const padRight = parseMarginValue(margin.value.right)
    const padBottom = parseMarginValue(margin.value.bottom)
    const padLeft = parseMarginValue(margin.value.left)
    const contentWidth = pageWidthPx - padLeft - padRight

    container.className = 'markdown-body'
    container.style.width = `${contentWidth}px`
    container.style.fontFamily = `${fontFamilyCSS(font.value)}, sans-serif`
    container.style.fontSize = `${fontSize.value}px`
    container.style.lineHeight = '1.5'
    container.style.padding = '0'
    container.style.margin = '0'
    container.innerHTML = html.value
    await waitForImages(container)

    container.querySelectorAll('table').forEach(t => {
      t.style.display = 'table'
      t.style.width = '100%'
      t.style.tableLayout = 'fixed'
    })

    const children = Array.from(container.children) as HTMLElement[]
    if (children.length === 0) {
      pages.value = [{ index: 0, elements: [] }]
      totalPages.value = 1
      return
    }

    const maxPageHeight = pageHeight.value - padTop - padBottom
    const result: Page[] = []
    let currentPageElements: string[] = []
    let currentHeight = 0
    let prevMarginBottom = 0
    let firstContentOnPage = true

    for (const child of children) {
      const isPageBreak = child.dataset?.pageBreak === 'true'

      if (isPageBreak) {
        if (currentPageElements.length > 0) {
          result.push({ index: result.length, elements: currentPageElements })
        }
        currentPageElements = [child.outerHTML]
        currentHeight = 0
        prevMarginBottom = 0
        firstContentOnPage = true
        continue
      }

      const childHeight = getElementHeight(child)
      const style = window.getComputedStyle(child)
      const childMarginTop = parseFloat(style.marginTop) || 0
      const childMarginBottom = parseFloat(style.marginBottom) || 0
      const collapsedMargin = firstContentOnPage
        ? childMarginTop
        : Math.min(prevMarginBottom, childMarginTop)
      const effectiveHeight = childHeight - collapsedMargin

      // At a page break, the browser print engine truncates the last element's 
      // marginBottom to 0. Account for this in the overflow check so the preview 
      // matches print output. Without this, the preview counts marginBottom that 
      // print discards, causing slightly different page fills.
      const effectivePageHeight = firstContentOnPage
        ? maxPageHeight
        : maxPageHeight + prevMarginBottom

      if (child.tagName === 'UL' || child.tagName === 'OL') {
        const fitsOnPage = firstContentOnPage
          ? childHeight <= maxPageHeight
          : currentHeight + effectiveHeight <= effectivePageHeight

        if (!fitsOnPage) {
          if (currentPageElements.length > 0) {
            result.push({ index: result.length, elements: currentPageElements })
            currentPageElements = []
            currentHeight = 0
            prevMarginBottom = 0
            firstContentOnPage = true
          }

          if (childHeight <= maxPageHeight) {
            child.style.setProperty('margin-top', '0', 'important')
            currentPageElements.push(child.outerHTML)
            currentHeight = childHeight - childMarginTop
            prevMarginBottom = childMarginBottom
            firstContentOnPage = false
          } else {
            const chunks = splitList(child as HTMLElement, maxPageHeight, maxPageHeight, contentWidth,
              `${fontFamilyCSS(font.value)}, sans-serif`, fontSize.value)

            for (let i = 0; i < chunks.length; i++) {
              currentPageElements.push(chunks[i])
              if (i < chunks.length - 1) {
                result.push({ index: result.length, elements: currentPageElements })
                currentPageElements = []
                currentHeight = 0
                prevMarginBottom = 0
                firstContentOnPage = true
              }
            }
            firstContentOnPage = false
          }

          continue
        }

        if (firstContentOnPage) {
          child.style.setProperty('margin-top', '0', 'important')
        }
        currentPageElements.push(child.outerHTML)
        currentHeight += effectiveHeight
        prevMarginBottom = childMarginBottom
        firstContentOnPage = false
        continue
      }

      if (currentHeight + effectiveHeight > effectivePageHeight && currentPageElements.length > 0) {
        result.push({ index: result.length, elements: currentPageElements })
        child.style.setProperty('margin-top', '0', 'important')
        currentPageElements = [child.outerHTML]
        currentHeight = childHeight - childMarginTop
        prevMarginBottom = childMarginBottom
        firstContentOnPage = false
        continue
      }

      if (child.tagName === 'TABLE' && childHeight > maxPageHeight) {
        if (currentPageElements.length > 0) {
          result.push({ index: result.length, elements: currentPageElements })
          currentPageElements = []
          currentHeight = 0
          prevMarginBottom = 0
          firstContentOnPage = true
        }

        const chunks = splitTable(child as HTMLElement, maxPageHeight, contentWidth, `${fontFamilyCSS(font.value)}, sans-serif`, fontSize.value)
        for (let i = 0; i < chunks.length; i++) {
          currentPageElements.push(chunks[i])
          if (i < chunks.length - 1) {
            result.push({ index: result.length, elements: currentPageElements })
            currentPageElements = []
            currentHeight = 0
            prevMarginBottom = 0
            firstContentOnPage = true
          }
        }
        firstContentOnPage = false
        continue
      }

      if (firstContentOnPage) {
        child.style.setProperty('margin-top', '0', 'important')
      }
      currentPageElements.push(child.outerHTML)
      currentHeight += effectiveHeight
      prevMarginBottom = childMarginBottom
      firstContentOnPage = false
    }

    if (currentPageElements.length > 0) {
      result.push({ index: result.length, elements: currentPageElements })
    }

    pages.value = result.length > 0 ? result : [{ index: 0, elements: [] }]
    totalPages.value = result.length || 1
  }

  let recalcTimeout: ReturnType<typeof setTimeout>
  watch(
    [html, pageHeight, scale, pageSize, margin, font, fontSize],
    () => {
      clearTimeout(recalcTimeout)
      recalcTimeout = setTimeout(() => {
        nextTick(splitIntoPages)
      }, 100)
    },
    { immediate: true },
  )

  return { pages, totalPages }
}
