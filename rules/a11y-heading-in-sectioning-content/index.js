const { generateTagFormatter } = require('../../libs/format_styled_components')

const EXPECTED_NAMES = {
  'PageHeading$': 'PageHeading$',
  'Heading$': 'Heading$',
  '^h1$': 'PageHeading$',
  '^h(|2|3|4|5|6)$': 'Heading$',
  'Article$': 'Article$',
  'Aside$': 'Aside$',
  'Nav$': 'Nav$',
  'Section$': 'Section$',
  'ModelessDialog$': 'ModelessDialog$',
  'Center$': 'Center$',
  'Reel$': 'Reel$',
  'Sidebar$': 'Sidebar$',
  'Stack$': 'Stack$',
}

const unexpectedMessageTemplate = `{{extended}} は smarthr-ui/{{expected}} をextendすることを期待する名称になっています
 - childrenにHeadingを含まない場合、コンポーネントの名称から"{{expected}}"を取り除いてください
 - childrenにHeadingを含み、アウトラインの範囲を指定するためのコンポーネントならば、smarthr-ui/{{expected}}をexendしてください
   - "styled(Xxxx)" 形式の場合、拡張元であるXxxxコンポーネントの名称の末尾に"{{expected}}"を設定し、そのコンポーネント内でsmarthr-ui/{{expected}}を利用してください`
const UNEXPECTED_NAMES = {
  '(Heading|^h(1|2|3|4|5|6))$': '(Heading)$',
  '(A|^a)rticle$': [
    '(Article)$',
    unexpectedMessageTemplate,
  ],
  '(A|^a)side$': [
    '(Aside)$',
    unexpectedMessageTemplate,
  ],
  '(N|^n)av$': [
    '(Nav)$',
    unexpectedMessageTemplate,
  ],
  '(S|^s)ection$': [
    '(Section)$',
    unexpectedMessageTemplate,
  ],
  'Center$': '(Center)$',
  'Reel$': '(Reel)$',
  'Sidebar$': '(Sidebar)$',
  'Stack$': '(Stack)$',
}

const headingRegex = /((^h(1|2|3|4|5|6))|Heading)$/
const pageHeadingRegex = /PageHeading$/
const declaratorHeadingRegex = /Heading$/
const sectioningRegex = /((A(rticle|side))|Nav|Section|^SectioningFragment)$/
const bareTagRegex = /^(article|aside|nav|section)$/
const modelessDialogRegex = /ModelessDialog$/
const layoutComponentRegex = /((C(ent|lust)er)|Reel|Sidebar|Stack)$/
const asRegex = /^(as|forwardedAs)$/

const includeSectioningAsAttr = (a) => a.name?.name.match(asRegex) && a.value.value.match(bareTagRegex)

const noHeadingTagNames = ['span', 'legend']
const ignoreHeadingCheckParentType = ['Program', 'ExportNamedDeclaration']

const headingMessage = `smarthr-ui/Headingと紐づく内容の範囲（アウトライン）が曖昧になっています。
 - smarthr-uiのArticle, Aside, Nav, SectionのいずれかでHeadingコンポーネントと内容をラップしてHeadingに対応する範囲を明確に指定してください。
 - 'as="section"' などでアウトラインを示している場合、as属性を指定した要素をsmarthr-ui/SectioningFragmentでラップしてください。
  - 要素内のHeadingのレベルが自動計算されるようになります。`
const rootHeadingMessage = `${headingMessage}
 - Headingをh1にしたい場合(機能名、ページ名などこのページ内でもっとも重要な見出しの場合)、smarthr-ui/PageHeadingを利用してください。その場合はSectionなどでアウトラインを示す必要はありません。`
const pageHeadingMessage = 'smarthr-ui/PageHeading が同一ファイル内に複数存在しています。PageHeadingはh1タグを出力するため最も重要な見出しにのみ利用してください。'
const pageHeadingInSectionMessage = 'smarthr-ui/PageHeadingはsmarthr-uiのArticle, Aside, Nav, Sectionで囲まないでください。囲んでしまうとページ全体の見出しではなくなってしまいます。'
const noTagAttrMessage = `tag属性を指定せず、smarthr-uiのArticle, Aside, Nav, Section, SectioningFragmentのいずれかの自動レベル計算に任せるよう、tag属性を削除してください。
 - tag属性を指定することで意図しないレベルに固定されてしまう可能性があります。`

const VariableDeclaratorBareToSHR = (context, node) => {
  if (!node.init) {
    return
  }

  const tag = node.init.tag || node.init

  if (tag.object?.name === 'styled') {
    const message = reportMessageBareToSHR(tag.property.name, true)

    if (message) {
      context.report({
        node,
        message,
      });
    }
  }
}
const reportMessageBareToSHR = (tagName, visibleExample) => {
  const matcher = tagName.match(bareTagRegex)

  if (matcher) {
    const base = matcher[1]
    const shrComponent = `${base[0].toUpperCase()}${base.slice(1)}`

    return `"${base}"を利用せず、smarthr-ui/${shrComponent}を拡張してください。Headingのレベルが自動計算されるようになります。${visibleExample ? `(例: "styled.${base}" -> "styled(${shrComponent})")` : ''}`
  }
}

const searchBubbleUp = (node) => {
  if (
    node.type === 'Program' ||
    node.type === 'JSXElement' && node.openingElement.name.name && (
      node.openingElement.name.name.match(sectioningRegex) ||
      node.openingElement.name.name.match(layoutComponentRegex) && node.openingElement.attributes.some(includeSectioningAsAttr)
    )
  ) {
    return node
  }

  if (
    // Headingコンポーネントの拡張なので対象外
    node.type === 'VariableDeclarator' && ignoreHeadingCheckParentType.includes(node.parent.parent?.type) && node.id.name.match(declaratorHeadingRegex) ||
    node.type === 'FunctionDeclaration' && ignoreHeadingCheckParentType.includes(node.parent.type) && node.id.name.match(declaratorHeadingRegex) ||
    // ModelessDialogのheaderにHeadingを設定している場合も対象外
    node.type === 'JSXAttribute' && node.name.name === 'header' && node.parent.name.name.match(modelessDialogRegex)
  ) {
    return null
  }

  return searchBubbleUp(node.parent)
}

const findTagAttr = (a) => a.name?.name == 'tag'

module.exports = {
  meta: {
    type: 'suggestion',
    schema: [],
  },
  create(context) {
    let h1s = []
    let sections = []
    let { VariableDeclarator, ...formatter } = generateTagFormatter({ context, EXPECTED_NAMES, UNEXPECTED_NAMES, unexpectedMessageTemplate })

    formatter.VariableDeclarator = (node) => {
      VariableDeclarator(node)
      VariableDeclaratorBareToSHR(context, node)
    }

    return {
      ...formatter,
      JSXOpeningElement: (node) => {
        const elementName = node.name.name || ''
        const message = reportMessageBareToSHR(elementName, false)

        if (message) {
          context.report({
            node,
            message,
          })
        // Headingに明示的にtag属性が設定されており、それらが span or legend の場合はHeading扱いしない
        } else if (elementName.match(headingRegex)) {
          const tagAttr = node.attributes.find(findTagAttr)

          if (!noHeadingTagNames.includes(tagAttr?.value.value)) {
            const result = searchBubbleUp(node.parent)
            let hit = false

            if (result) {
              if (elementName.match(pageHeadingRegex)) {
                h1s.push(node)

                if (h1s.length > 1) {
                  hit = true
                  context.report({
                    node,
                    message: pageHeadingMessage,
                  })
                } else if (result.type !== 'Program') {
                  hit = true
                  context.report({
                    node,
                    message: pageHeadingInSectionMessage,
                  })
                }
              } else if (result.type === 'Program') {
                hit = true
                context.report({
                  node,
                  message: rootHeadingMessage,
                })
              } else if (sections.find((s) => s === result)) {
                hit = true
                context.report({
                  node,
                  message: headingMessage,
                })
              } else {
                sections.push(result)
              }
            }

            if (!hit && tagAttr) {
              context.report({
                node: tagAttr,
                message: noTagAttrMessage,
              })
            }
          }
        }
      },
    }
  },
}
module.exports.schema = []
