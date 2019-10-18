import { GraphQLScalarType, Kind } from 'graphql'
import {filterXSS, IFilterXSSOptions, IWhiteList} from 'xss'

const defaultName = 'SanitizedString'

export const scalar = defaultName

const noop = (html: string) => html

export interface SanitizeOptions {
  allowHTMLTags?: boolean
  stripIgnoreTag?: boolean
}

const serialize = (input: string, options?: IFilterXSSOptions) => {
  return filterXSS(input, options)
}

const parseValue = (value: string, options?: IFilterXSSOptions) => {
  return filterXSS(value, options)
}

export class SanitizedStringType extends GraphQLScalarType {
  constructor(options?: SanitizeOptions) {
    const allowHTMLTags = options && options.allowHTMLTags
    const stripIgnoreTag = !options || options.stripIgnoreTag !== false
    const xssOptions: IFilterXSSOptions = {
      stripIgnoreTag,
      ...!allowHTMLTags && {whiteList: [] as IWhiteList},
      ...stripIgnoreTag && {escapeHtml: noop},
    }

    super({
      name: options ? `Custom${defaultName}` : defaultName,
      parseLiteral: ast => {
        switch(ast.kind) {
          case Kind.STRING:
            return parseValue(ast.value, xssOptions)
          default:
            return null
        }
      },
      parseValue: value => parseValue(value, xssOptions),
      serialize: value => serialize(value, xssOptions),
    })
  }
}

export const resolvers = new SanitizedStringType()
