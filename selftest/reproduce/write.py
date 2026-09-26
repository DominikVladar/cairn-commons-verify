# Self-test: the code directory is read-only.
open("/work/x.txt", "w").write("x")
print("wrote")
