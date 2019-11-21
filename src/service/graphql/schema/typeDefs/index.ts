import { GraphQLScalarType } from 'graphql'
import { GraphQLUpload } from 'graphql-upload'
import { keys, reduce } from 'ramda'

import { SchemaMetaData } from '..'

import { resolvers as ioUploadResolvers } from './ioUpload'
import { resolvers as sanitizedStringResolvers } from './sanitizedString'

export const nativeResolvers = {
  'IOSanitizedString': sanitizedStringResolvers,
  'IOUpload': ioUploadResolvers,
  'Upload': GraphQLUpload as GraphQLScalarType,
}

export const nativeTypeDefs = (metaData: SchemaMetaData) => reduce(
  (acc, scalar) => !metaData[scalar] ? `${acc}\nscalar ${scalar}\n` : acc,
  '',
  keys(nativeResolvers)
)
