export const ROUTER_PROMPT = `
Given a message from the user about a book, determine what the message is about:

A: The Author
B: Summary, Book Metadata, or Table of Content 
C: Content inside the book

Return a json with using just the letter capitalized in the following format: 

{
intent: "A"
}
`.trim();
