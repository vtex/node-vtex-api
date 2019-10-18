import { GraphQLUpload } from 'apollo-server-core'
import { GraphQLScalarType } from 'graphql'
import { keys, reduce } from 'ramda'

import { SchemaMetaData } from '..'

import { NativeResolverContext, resolvers as ioMessageResolvers } from './ioMessage'
import { resolvers as ioUploadResolvers } from './ioUpload'
import { resolvers as sanitizedStringResolvers } from './sanitizedString'

export const scalarResolversMap = {
  'IOMessage': ioMessageResolvers,
  'IOUpload': ioUploadResolvers,
  'SanitizedString': sanitizedStringResolvers,
  'Upload': GraphQLUpload as GraphQLScalarType,
}

export const shouldNotCacheWhenSchemaHas = ['IOMessage']

export const nativeResolvers = (ctx: NativeResolverContext) => ({
  'IOMessage': scalarResolversMap.IOMessage(ctx),
  'IOUpload': scalarResolversMap.IOUpload,
  'SanitizedString': scalarResolversMap.SanitizedString,
  'Upload': scalarResolversMap.Upload,
})

export const nativeTypeDefs = (metaData: SchemaMetaData) => reduce(
  (acc, scalar) => !metaData[scalar] ? `${acc}\nscalar ${scalar}\n` : acc,
  '',
  keys(scalarResolversMap)
)
