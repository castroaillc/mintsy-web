import Foundation
import Testing
@testable import Mintsy

struct CatalogTests {
    @Test func decodesTheBooksQueryIncludingOptionalFields() throws {
        let json = #"""
        {"id":"b","title":"T","author":"A","category":"Finance","coverTone":"#E3D6B4","coverUrl":null,"tint":"#3A3220",
         "description":"D","episodes":[
           {"id":"b-1","number":1,"title":"One","summary":"S","durationSec":279,"transcript":[{"startSec":5,"text":"Hi"}],
            "takeaways":["x"],"videoUrl":"https://media.test/1.mp4","thumbnailUrl":null,"locked":false},
           {"id":"b-4","number":4,"title":"Four","summary":"S","durationSec":300,"transcript":[],"takeaways":[],
            "videoUrl":null,"thumbnailUrl":null,"locked":true}
         ]}
        """#
        let book = try JSONDecoder().decode(Book.self, from: Data(json.utf8))
        #expect(book.episodes.count == 2)
        #expect(book.episodes[0].videoUrl?.absoluteString == "https://media.test/1.mp4")
        #expect(book.episodes[0].hlsUrl == nil)
        #expect(book.episodes[1].locked)
        #expect(book.coverUrl == nil)
    }

    @Test func theBooksQueryOnlyAsksForHLSWhenEnabled() {
        #expect(CatalogQueries.books(hlsEnabled: true).contains("hlsUrl"))
        #expect(!CatalogQueries.books(hlsEnabled: false).contains("hlsUrl"))
    }

    @Test func formatsTimesAndRuntimes() {
        #expect(SeriesFormat.time(312) == "5:12")
        #expect(SeriesFormat.time(5) == "0:05")
        #expect(SeriesFormat.time(-3) == "0:00")
        #expect(SeriesFormat.runtime(6060) == "1 hr 41 min")
        #expect(SeriesFormat.runtime(280) == "5 min")
    }

    @Test func homeFeaturesTheFirstPlayableBookAndFilters() {
        let empty = Book(id: "empty", title: "Coming soon", author: "X", category: "History")
        let money = Book(id: "money", title: "Money", author: "Y", category: "Finance", episodes: [Episode(id: "money-1", number: 1, title: "1", durationSec: 60)])
        let mind = Book(id: "mind", title: "Mind", author: "Z", category: "Psychology", episodes: [Episode(id: "mind-1", number: 1, title: "1", durationSec: 60)])

        let all = HomeSections(books: [empty, money, mind], query: "", category: HomeSections.allCategories)
        #expect(all.featured?.id == "money")
        #expect(all.rows.map(\.title) == ["More in Finance", "Recently added"])
        #expect(all.rows[1].books.map(\.id) == ["mind", "money", "empty"])

        let searching = HomeSections(books: [empty, money, mind], query: "mind", category: HomeSections.allCategories)
        #expect(searching.featured == nil)
        #expect(searching.visible.map(\.id) == ["mind"])

        let psychology = HomeSections(books: [empty, money, mind], query: "", category: "Psychology")
        #expect(psychology.featured == nil)
        #expect(psychology.rows.first?.title == "More in Psychology")
    }

    @Test func coverInkReadsOnTheTone() {
        #expect(CoverInk.isLight("#E3D6B4"))
        #expect(!CoverInk.isLight("#2B2850"))
    }
}
