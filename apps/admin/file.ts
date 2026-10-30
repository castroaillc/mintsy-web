// Service - A
// Find the book 
// Download the book
// Upload it to storage
// Update the db 
// Send a message -> Book in storage

interface Book {
    source: {
        url: string;
    }
    data: {
        title: string;
    }
}

class ServiceA {
    book: Book;
    constructor() {
            this.book = {
                source: {
                    url: "https://example.com/book.pdf"
                },
                data: {
                    title: "Example Book"
                }
            };
    }
}



console.log("Service A initialized with book:", new ServiceA().book);