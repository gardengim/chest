# Final text and translation review

Reviewed the English interface vocabulary and all 574 entries in each of the Korean, Spanish, Japanese, Simplified Chinese, Traditional Chinese and Arabic dictionaries. Checked context, singular/plural usage, action labels, accessibility labels, theme terminology and placeholders. Brand names, imported theme data values and original technical diagnostics remain intact.

Corrected 36 entries: Korean particles and world/action labels; Spanish theme terminology and grammar; built-in theme terminology across languages; Traditional Chinese data-folder labels; Simplified Chinese native-library wording and spacing; Arabic theme, instance-count, navigation, update and test-profile wording. Preserved the requested Develop, Contents, Cancel and Korean 저장 취소 terms.

The isolated sign-in return page now translates its title/message using browser language preferences, including Chinese script/region selection and Arabic RTL. It does not access launcher preferences or introduce network requests. Its existing script hash and privacy headers remain covered by the core test.

Validation uses dictionary key/placeholder/duplicate checks, literal UI and native-menu coverage, callback language fallback tests, localized settings/dialog/RTL browser checks, Svelte diagnostics and the callback privacy/CSP test. This is a code and language review; it does not replace native-speaker proofreading.
