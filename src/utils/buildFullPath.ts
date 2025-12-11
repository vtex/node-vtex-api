// This module is part of the Axios library.
// It is used to build a full URL by combining a base URL with a relative URL.

// It is originally not intended to be used directly, but rather as a utility function within the Axios library.
// Since Axios 1.0, this function is not exported by default, and the team does not recommend using it directly, 
// as it may not be available in future versions.

// The function takes a base URL and a relative URL as input, and returns the full URL.
// It handles both absolute and relative URLs, and ensures that the resulting URL is properly formatted.
// It is used internally by Axios to construct the full URL for HTTP requests.

/**
 * Creates a new URL by combining the baseURL with the requestedURL,
 * only when the requestedURL is not already an absolute URL.
 * If the requestURL is absolute, this function returns the requestedURL untouched.
 *
 * @param {string} baseURL The base URL
 * @param {string} requestedURL Absolute or relative URL to combine
 *
 * @returns {string} The combined full path
 */
export default function(baseURL?: string, requestedURL?: string, allowAbsoluteUrls?: boolean): string | undefined {
    const isRelativeUrl = !isAbsoluteURL(requestedURL)
    if (baseURL && (isRelativeUrl || allowAbsoluteUrls === false)) {
      return combineURLs(baseURL, requestedURL)
    }
    return requestedURL
  }
  
  /**
   * Determines whether the specified URL is absolute
   *
   * @param {string} url The URL to test
   *
   * @returns {boolean} True if the specified URL is absolute, otherwise false
   */
  function isAbsoluteURL(url?: string): boolean {
      // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
      // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
      // by any combination of letters, digits, plus, period, or hyphen.
      return !!url && /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url)
  }
  
  /**
   * Creates a new URL by combining the specified URLs
   *
   * @param {string} baseURL The base URL
   * @param {string} relativeURL The relative URL
   *
   * @returns {string} The combined URL
   */
  function combineURLs(baseURL?: string, relativeURL?: string): string | undefined {
      return relativeURL && baseURL
        ? baseURL.replace(/\/?\/$/, '') + '/' + relativeURL.replace(/^\/+/, '')
        : baseURL
  }