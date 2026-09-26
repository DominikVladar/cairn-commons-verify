# Self-test: the sandbox has no network, so this must not print the expected output.
import urllib.request
print(urllib.request.urlopen("https://example.com", timeout=5).status)
