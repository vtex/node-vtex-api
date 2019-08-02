export default class CustomGraphQLError extends Error {
  public graphQLErrors: any

  public constructor(message: string, graphQLErrors: any[]) {
    super(message)
    this.graphQLErrors = graphQLErrors
  }
}
