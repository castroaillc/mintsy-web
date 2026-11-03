"""Reads the GraphQL `books { id title }` response on stdin; prints the title of the book id in argv[1]."""
import json
import sys

books = json.load(sys.stdin)["data"]["books"]
print(next(b["title"] for b in books if b["id"] == sys.argv[1]))
