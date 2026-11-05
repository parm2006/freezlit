import sys,unittest
from spelling import suggestions
class WindowsSpellingTests(unittest.TestCase):
    def test_rejects_invalid_word_input(self):
        for word in ('two words','', 'a'*129, '<script>', None):
            with self.assertRaises(ValueError):suggestions(word)
    def test_rejects_invalid_language(self):
        with self.assertRaises(ValueError):suggestions('word','bad/language')
    @unittest.skipUnless(sys.platform=='win32','Uses the installed Windows dictionary')
    def test_native_dictionary_checks_and_corrects(self):
        result=suggestions('mispelled')
        if not result['available']:self.skipTest('English spelling dictionary is not installed.')
        self.assertIn('misspelled',result['suggestions'])
        self.assertIn('sentence',suggestions('sentnce')['suggestions'])
        self.assertTrue(suggestions('sentence')['correct'])
    @unittest.skipUnless(sys.platform=='win32','Uses the installed Windows dictionary')
    def test_unavailable_language_is_reported(self):
        self.assertFalse(suggestions('word','zz-ZZ')['available'])
if __name__=='__main__':unittest.main()
