const { generateTagFormatter } = require('../../libs/format_styled_components');

const EXPECTED_NAMES = {
  '(i|I)nput$': 'Input$',
  '(t|T)extarea$': 'Textarea$',
  '(s|S)elect$': 'Select$',
  'InputFile$': 'InputFile$',
  'RadioButtonPanel$': 'RadioButtonPanel$',
  'Check(b|B)ox$': 'CheckBox$',
  'Combo(b|B)ox$': 'ComboBox$',
  'DatePicker$': 'DatePicker$',
  'DropZone$': 'DropZone$',
  'Switch$': 'Switch$',
  'SegmentedControl$': 'SegmentedControl$',
  'RightFixedNote$': 'RightFixedNote$',
  'FieldSet$': 'FieldSet$',
  '(b|B)utton$': 'Button$',
  'Anchor$': 'Anchor$',
  'Link$': 'Link$',
  'TabItem$': 'TabItem$',
  '^a$': '(Anchor|Link)$',

  '(f|F)orm$': 'Form$',
  'ActionDialogWithTrigger$': 'ActionDialogWithTrigger$',
  'RemoteDialogTrigger$': 'RemoteDialogTrigger$',
  'RemoteTrigger(.+)Dialog$': 'RemoteTrigger(.+)Dialog$',
  'FormDialog$': 'FormDialog$',
  'Pagination$': 'Pagination$',
  'SideNav$': 'SideNav$',
  'AccordionPanel$': 'AccordionPanel$',
}

const UNEXPECTED_NAMES = {
  '(B|^b)utton$': '(Button)$',
  '(Anchor|^a)$': '(Anchor)$',
  '(Link|^a)$': '(Link)$',
}

const INTERACTIVE_COMPONENT_NAMES = Object.keys(EXPECTED_NAMES)
const INTERACTIVE_ON_REGEX = /^on(Change|Input|Focus|Blur|(Double)?Click|Key(Down|Up|Press)|Mouse(Enter|Over|Down|Up|Leave)|Select|Submit)$/

const messageNonInteractiveEventHandler = (nodeName, interactiveComponentRegex, onAttrs) => {
  const onAttrsText = onAttrs.join(', ')

  return `${nodeName} に${onAttrsText}を設定するとブラウザが正しく解釈が行えず、ユーザーが利用することが出来ない場合があるため、以下のいずれかの対応をおこなってください。
 - 方法1:  ${nodeName}がinput、buttonやaなどのインタラクティブな要素の場合、コンポーネント名の末尾をインタラクティブなコンポーネントであることがわかる名称に変更してください
   - "${interactiveComponentRegex}" の正規表現にmatchするコンポーネントに差し替える、もしくは名称を変更してください
 - 方法2: インタラクティブな親要素、もしくは子要素が存在する場合、直接${onAttrsText}を設定することを検討してください
 - 方法3: インタラクティブな親要素、もしくは子要素が存在しない場合、インタラクティブな要素を必ず持つようにマークアップを修正後、${onAttrsText}の設定要素を検討してください
 - 方法4: インタラクティブな子要素から発生したイベントをキャッチすることが目的で${onAttrsText}を設定している場合、'role="presentation"' を設定してください`
}
const messageRolePresentationNotHasInteractive = (nodeName, interactiveComponentRegex, onAttrs) => `${nodeName}に 'role="presentation"' が設定されているにも関わらず、子要素にinput、buttonやaなどのインタラクティブな要素が見つからないため、ブラウザが正しく解釈が行えず、ユーザーが利用することが出来ない場合があるため、以下のいずれかの対応をおこなってください。
 - 方法1: 子要素にインタラクティブな要素が存在するにも関わらずこのエラーが表示されている場合、子要素の名称を変更してください
   - "${interactiveComponentRegex}" の正規表現にmatchするよう、インタラクティブな子要素全てを差し替える、もしくは名称を変更してください
 - 方法2: ${nodeName}自体がインタラクティブな要素の場合、'role="presentation"'を削除した上で名称を変更してください
   - "${interactiveComponentRegex}" の正規表現にmatchするよう、${nodeName}の名称を変更してください
 - 方法3: 子要素にインタラクティブな要素が存在し、${onAttrs.join(', ')}全属性をそれらの要素に移動させられる場合、'role="presentation"'を消した上で実施してください`
const messageInteractiveHasRolePresentation = (nodeName, interactiveComponentRegex) => `${nodeName}はinput、buttonやaなどのインタラクティブな要素にもかかわらず 'role="presentation"' が設定されているため、ブラウザが正しく解釈が行えず、ユーザーが利用することが出来ない場合があるため、以下のいずれかの対応をおこなってください。
 - 方法1: 'role="presentation"' を削除してください
 - 方法2: ${nodeName}の名称を "${interactiveComponentRegex}" とマッチしない名称に変更してください`

const SCHEMA = [
  {
    type: 'object',
    properties: {
      additionalInteractiveComponentRegex: { type: 'array', items: { type: 'string' } },
    },
    additionalProperties: false,
  }
]

module.exports = {
  meta: {
    type: 'problem',
    schema: SCHEMA,
  },
  create(context) {
    const options = context.options[0]
    const interactiveComponentRegex = new RegExp(`(${INTERACTIVE_COMPONENT_NAMES.join('|')}${options?.additionalInteractiveComponentRegex ? `|${options.additionalInteractiveComponentRegex.join('|')}` : ''})`)

    return {
      ...generateTagFormatter({ context, EXPECTED_NAMES, UNEXPECTED_NAMES }),
      JSXOpeningElement: (node) => {
        const nodeName = node.name.name || '';

        let onAttrs = []
        let isRolePresentation = false

        node.attributes.forEach((a) => {
          const aName = a.name?.name || ''

          if (aName.match(INTERACTIVE_ON_REGEX)) {
            onAttrs.push(aName)
          } else if (aName === 'role' && a.value?.value === 'presentation') {
            isRolePresentation = true
          }
        })

        if (!nodeName.match(interactiveComponentRegex)) {
          if (onAttrs.length > 0) {
            if (!isRolePresentation) {
              context.report({
                node,
                message: messageNonInteractiveEventHandler(nodeName, interactiveComponentRegex, onAttrs),
              });
            } else {
              const isHasInteractive = (c) => {
                if (c.type === 'JSXElement') {
                  if ((c.openingElement.name.name || '').match(interactiveComponentRegex)) {
                    return true
                  }

                  if (c.children.length > 0) {
                    return c.children.find(isHasInteractive)
                  }
                }

                return false
              }

              if (!node.parent.children.find(isHasInteractive)) {
                context.report({
                  node,
                  message: messageRolePresentationNotHasInteractive(nodeName, interactiveComponentRegex, onAttrs)
                })
              }
            }
          }
        } else if (isRolePresentation) {
          context.report({
            node,
            message: messageInteractiveHasRolePresentation(nodeName, interactiveComponentRegex)
          })
        }
      },
    };
  },
};
module.exports.schema = SCHEMA;