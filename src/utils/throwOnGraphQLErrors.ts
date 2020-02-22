import CustomGraphQLError from '../errors/customGraphQLError'
import { GraphQLResponse } from '../HttpClient/GraphQLClient'

export function throwOnGraphQLErrors(message: string) {
  return function maybeGraphQLResponse(response: GraphQLResponse<any>) {
    if (response?.errors && response.errors.length > 0) {
      throw new CustomGraphQLError(message, response.errors)
    }

    return response
  }
}
