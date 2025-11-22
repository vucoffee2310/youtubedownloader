// Default JSON data - replace with your actual data structure
export const jsonData = {
  "page_1": [
    {
      "[y1, x1, y2, x2]": [88, 142, 198, 856],
      "text": "Sự sụt giảm đột ngột về độ chính xác (ví dụ: > 5–10% trong cửa sổ trượt 24 giờ), sự gia tăng việc bỏ ngang tác vụ (> 15%), hoặc sự tăng vọt trong số lần thử lại (tỷ lệ phiên > 20%) đều là những chỉ báo tiềm năng về sự trôi dạt đầu vào hoặc khái niệm. Các kỹ thuật dựa trên nhúng, chẳng hạn như tính toán độ tương đồng cosin giữa các vector truy vấn hiện tại và lịch sử, cũng có thể được sử dụng để so sánh các đầu vào mới với các đường cơ sở (ví dụ: độ tương đồng trung bình < 0.8 sẽ kích hoạt việc xem xét), thường được triển khai thông qua các thư viện như Evidently AI để cảnh báo tự động trong Grafana."
    },
    {
      "[y1, x1, y2, x2]": [215, 142, 495, 856],
      "text": "Phản ứng với những thay đổi này là một phần của việc xây dựng các hệ thống có khả năng phục hồi. Các thay đổi tạm thời có thể được giải quyết bằng cách tinh chỉnh các ngưỡng hoặc cập nhật logic phân tích cú pháp, trong khi những thay đổi dai dẳng có thể yêu cầu các luồng công việc huấn luyện lại hoặc thích ứng với các API mới. Các vòng lặp phản hồi, chẳng hạn như ghi nhật ký và xuất các dấu vết bị suy giảm để phân tích, giúp các đội xác định xem các vấn đề là tạm thời hay có tính hệ thống. Như mọi khi, các chiến lược phản ứng được hưởng lợi từ khả năng hiển thị thời gian thực được cung cấp bởi một ngăn xếp quan sát mạnh mẽ—cho phép các đội hành động trước khi sự trôi dạt trở thành thất bại. Phản ứng với những thay đổi này là một phần của việc xây dựng các hệ thống có khả năng phục hồi. Các thay đổi tạm thời có thể được giải quyết bằng cách tinh chỉnh các ngưỡng hoặc cập nhật logic phân tích cú pháp, trong khi những thay đổi dai dẳng có thể yêu cầu các luồng công việc huấn luyện lại hoặc thích ứng với các API mới—dựa trên mức độ nghiêm trọng của sự trôi dạt từ các thước đo thống kê (ví dụ: ưu tiên huấn luyện lại nếu PSI > 0.25 kéo dài hơn 48 giờ). Các vòng lặp phản hồi, chẳng hạn như ghi nhật ký và xuất các dấu vết bị suy giảm để phân tích, giúp các đội xác định xem các vấn đề là tạm thời hay có tính hệ thống—có thể thông qua thử nghiệm A/B sau khi phát hiện để xác thực các bản sửa lỗi. Như mọi khi, các chiến lược phản ứng được hưởng lợi từ khả năng hiển thị thời gian thực được cung cấp bởi một ngăn xếp quan sát mạnh mẽ—cho phép các đội hành động trước khi sự trôi dạt trở thành thất bại."
    },
    {
      "[y1, x1, y2, x2]": [512, 142, 532, 793],
      "text": "Quyền sở hữu chỉ số và Quản trị liên chức năng"
    },
    {
      "[y1, x1, y2, x2]": [550, 142, 686, 856],
      "text": "Khi các đội triển khai các hệ thống dựa trên tác tử, một thách thức tổ chức tinh vi nhưng nghiêm trọng xuất hiện: ai sở hữu chỉ số nào? Trong các ngăn xếp phần mềm truyền thống, có sự phân chia rõ ràng: đội ngũ hạ tầng sở hữu độ trễ và thời gian hoạt động, đội ngũ sản phẩm sở hữu tỷ lệ chuyển đổi hoặc thành công của người dùng, và đội ngũ ML (nếu có) xây dựng các mô hình, và quản lý tình trạng và hiệu suất của chúng, với trách nhiệm cho cả các tác động kỹ thuật và sản phẩm. Nhưng các tác tử được cung cấp bởi các mô hình nền tảng không tôn trọng những ranh giới này—và chiến lược giám sát của bạn cũng không nên như vậy."
    },
    {
      "[y1, x1, y2, x2]": [703, 142, 786, 856],
      "text": "Một phản hồi của mô hình nền tảng không chỉ là một tạo tác của mô hình, nó là sản phẩm. Một chuỗi dài các lệnh gọi công cụ, các lần thử lại, các phương án dự phòng và các bước tạo sinh không phải là một điều bất thường ở backend—nó là trải nghiệm người dùng. Và độ trễ năm giây trong việc tạo kế hoạch không phải là một hạn chế của mô hình—nó thường là một quyết định thiết kế lời nhắc hoặc luồng công việc mà ai đó trong đội sản phẩm đã đưa ra."
    },
    {
      "[y1, x1, y2, x2]": [803, 142, 869, 856],
      "text": "Đó là lý do tại sao nhật ký, dấu vết và các tín hiệu đánh giá từ các tác tử thuộc về nền tảng quan sát cốt lõi, cùng với tình trạng dịch vụ và các chỉ số hệ thống. Nếu các bảng điều khiển sản phẩm và các sổ tay mô hình là nơi duy nhất mà các chỉ số tác tử xuất hiện, bạn đang bỏ lỡ bức tranh toàn cảnh—và có khả năng đang che giấu các vấn đề mang tính hệ thống."
    },
    {
      "[y1, x1, y2, x2]": [923, 496, 935, 856],
      "text": "Quyền sở hữu chỉ số và Quản trị liên chức năng | 239"
    }
  ],
  "page_2": [
    {
      "[y1, x1, y2, x2]": [88, 142, 188, 856],
      "text": "Độ trễ là một ví dụ hoàn hảo. Các đội thường có tư duy rằng \"các mô hình nền tảng thì chậm,\" và sau đó vô tình xây dựng độ trễ vào mọi thứ—từ những lời nhắc dài dòng đến những lần thử lại không cần thiết cho đến những kế hoạch cồng kềnh. Nếu không có công cụ đo lường dựa trên dấu vết nghiêm ngặt, sự trôi dạt này sẽ không bị phát hiện. Chẳng bao lâu, toàn bộ hệ thống sẽ có cảm giác chậm chạp—không phải vì hạ tầng yếu, mà vì đội ngũ sản phẩm và ML đã bình thường hóa sự chậm trễ như một điều không thể tránh khỏi."
    },
    {
      "[y1, x1, y2, x2]": [205, 142, 238, 856],
      "text": "Giải pháp không phải là giao phó quyền sở hữu về độ trễ cho đội hạ tầng hay UX cho đội sản phẩm. Mà là xây dựng các bảng điều khiển chung nơi các đội có thể làm những việc sau:"
    },
    {
      "[y1, x1, y2, x2]": [255, 159, 338, 856],
      "list": [
        "Các trưởng nhóm sản phẩm có thể thấy độ trễ lập kế hoạch và tỷ lệ dự phòng tương quan với việc bỏ ngang tác vụ như thế nào.",
        "Các kỹ sư ML có thể theo dõi tỷ lệ ảo giác và sự trôi dạt cùng với phản hồi của người dùng.",
        "Các đội Hạ tầng/SRE có thể cảnh báo về việc lượng token tăng đột biến và công cụ hoạt động không ổn định ảnh hưởng đến độ tin cậy của hệ thống."
      ]
    },
    {
      "[y1, x1, y2, x2]": [355, 142, 438, 856],
      "text": "Mỗi đội phải sở hữu một phần dữ liệu đo từ xa của tác tử—và không một đội nào có thể diễn giải nó một cách riêng lẻ. Để giải quyết các thách thức tổ chức về quyền sở hữu chỉ số, các đội có thể sử dụng Ma trận Phân công Trách nhiệm (biểu đồ RACI) để làm rõ vai trò giữa các chức năng. Trong biểu đồ RACI, mỗi tác vụ hoặc chỉ số được gán một hoặc nhiều trong số các vai trò sau: R (Chịu trách nhiệm thực hiện), A (Chịu trách nhiệm cuối cùng), C (Được tham vấn), hoặc I (Được thông báo)."
    },
    {
      "[y1, x1, y2, x2]": [455, 142, 521, 856],
      "text": "Bảng 10-3 là một mẫu được tùy chỉnh cho việc giám sát tác tử, bạn có thể điều chỉnh dựa trên cấu trúc, quy mô và các chỉ số cụ thể của đội mình. Điều này thúc đẩy sự hợp tác liên chức năng bằng cách đảm bảo không có chỉ số nào bị bỏ sót trong khi tránh tình trạng các nhóm hoạt động riêng rẽ."
    },
    {
      "[y1, x1, y2, x2]": [550, 142, 562, 816],
      "text": "Bảng 10-3. Ma trận RACI về các chỉ số giám sát và trách nhiệm liên chức năng"
    },
    {
      "[y1, x1, y2, x2]": [581, 142, 893, 856],
      "table": [
        [
          "Chỉ số/Hoạt động",
          "Đội sản phẩm",
          "Kỹ sư ML",
          "Đội Hạ tầng/SRE"
        ],
        [
          "Độ trễ (ví dụ: độ trễ lập kế hoạch hoặc gọi công cụ)",
          "A (sở hữu tác động người dùng) / C (tham vấn về ngưỡng UX)",
          "R (tối ưu hóa lời nhắc/mô hình) / I (được thông báo về sự suy giảm)",
          "R (giám sát nguyên nhân từ hạ tầng) / C (tham vấn về việc mở rộng quy mô)"
        ],
        [
          "Tỷ lệ ảo giác",
          "C (cung cấp bối cảnh phản hồi người dùng) / I (được thông báo về xu hướng)",
          "A/R (sở hữu việc phát hiện/giảm thiểu thông qua đánh giá)",
          "I (được thông báo để thiết lập cảnh báo)"
        ],
        [
          "Tỷ lệ thành công của tác vụ",
          "A (sở hữu mục tiêu sản phẩm) / R (xác định tiêu chí thành công)",
          "C (tham vấn về cải tiến mô hình)",
          "I (được thông báo về các liên kết đến độ tin cậy của hệ thống)"
        ],
        [
          "Mức sử dụng/chi phí token",
          "C (tham vấn về tác động kinh doanh)",
          "R (tối ưu hóa các kết quả tạo sinh) / I (được thông báo về sự tăng đột biến)",
          "A (sở hữu việc lập ngân sách/mở rộng quy mô) / R (giám sát hiệu quả hạ tầng)"
        ],
        [
          "Dịch chuyển phân phối (ví dụ: trôi dạt đầu vào)",
          "I (được thông báo để điều chỉnh sản phẩm)",
          "A/R (phát hiện thông qua nhúng/đánh giá)",
          "C (tham vấn về độ ổn định của đường ống dữ liệu)"
        ]
      ]
    },
    {
      "[y1, x1, y2, x2]": [923, 142, 935, 438],
      "text": "240 | Chương 10: Giám sát trong môi trường sản xuất"
    }
  ],
  "page_3": [
    {
      "[y1, x1, y2, x2]": [81, 142, 233, 856],
      "table": [
        [
          "Chỉ số/Hoạt động",
          "Đội sản phẩm",
          "Kỹ sư ML",
          "Đội Hạ tầng/SRE"
        ],
        [
          "Tần suất dự phòng/thử lại",
          "C (tham vấn về các phương án dự phòng cho UX)",
          "R (tinh chỉnh logic lập kế hoạch)",
          "A (sở hữu độ tin cậy) / I (được thông báo về các mẫu)"
        ],
        [
          "Phản hồi/cảm tính của người dùng",
          "A/R (sở hữu việc tổng hợp và ưu tiên)",
          "C (tham vấn về các liên kết đến mô hình)",
          "I (được thông báo để đưa ra cảnh báo vận hành)"
        ],
        [
          "Các quy trình bảo trì và phân loại sự cố trên bảng điều khiển",
          "C (cung cấp bối cảnh sản phẩm)",
          "C (cung cấp thông tin chuyên sâu về ML)",
          "A/R (sở hữu nền tảng và các buổi đánh giá liên đội)"
        ]
      ]
    },
    {
      "[y1, x1, y2, x2]": [249, 142, 315, 856],
      "text": "Một dấu vết cho thấy một công cụ được gọi bốn lần trong một vòng lặp, theo sau là một quá trình tạo sinh dài, một phản hồi mơ hồ, và người dùng bỏ ngang—đó không chỉ là một chi tiết kỹ thuật. Đó là một thất bại của sản phẩm. Và nó chỉ có thể nhìn thấy được khi nhật ký và các span được chuyển qua một nền tảng chung như Loki và Tempo, chứ không bị ẩn trong các tab chỉ số riêng rẽ."
    },
    {
      "[y1, x1, y2, x2]": [332, 142, 345, 551],
      "text": "Để làm được điều này, hãy sử dụng thực hành sau:"
    },
    {
      "[y1, x1, y2, x2]": [362, 159, 545, 856],
      "list": [
        "Sử dụng các bảng điều khiển quan sát chung với các thẻ phiên bản và chỉ số ngữ nghĩa. Các đội hiệu quả cao không tranh cãi xem bảng điều khiển nào chính xác hơn—họ làm việc vượt qua các ranh giới chức năng để cùng nhau cải thiện trải nghiệm cho khách hàng.",
        "Gắn thẻ các span và nhật ký với bối cảnh sản phẩm (cờ tính năng, hạng người dùng, ID luồng công việc).",
        "Tạo ra các quy trình phân loại sự cố liên chức năng, nơi sản phẩm, hạ tầng và ML cùng nhau xem xét dữ liệu đo từ xa—đặc biệt là sau các lần ra mắt hoặc các sự cố suy giảm nghiêm trọng.",
        "Tránh các tiêu chuẩn kép: đừng đặt ra một tiêu chuẩn khác cho độ trễ của mô hình nền tảng so với các dịch vụ khác. Sự chậm chạp ảnh hưởng đến người dùng là vấn đề của tất cả mọi người."
      ]
    },
    {
      "[y1, x1, y2, x2]": [562, 142, 645, 856],
      "text": "Các hệ thống tác tử đòi hỏi khả năng quan sát liên chức năng. Ngăn xếp giám sát không chỉ dùng để phát hiện sự cố ngừng hoạt động—nó là giao diện qua đó các đội kỹ thuật, ML và sản phẩm học cách nói cùng một ngôn ngữ về những gì hệ thống đang làm, nó đang hoạt động tốt như thế nào, và nó cần phát triển ở đâu."
    },
    {
      "[y1, x1, y2, x2]": [662, 142, 682, 246],
      "text": "Kết luận"
    },
    {
      "[y1, x1, y2, x2]": [700, 142, 766, 856],
      "text": "Giám sát các hệ thống dựa trên tác tử không chỉ là một biện pháp kiểm tra an toàn—nó là lĩnh vực cho phép các hệ thống thông minh phát triển mạnh trong môi trường thực tế. Trong chương này, chúng ta đã thấy rằng việc giám sát không chỉ là bị động; đó là cách các đội học hỏi từ môi trường sản xuất, thích ứng với thay đổi và tăng tốc tiến độ."
    },
    {
      "[y1, x1, y2, x2]": [783, 142, 866, 856],
      "text": "Từ việc đo lường nền tảng với OpenTelemetry, đến việc thu thập nhật ký và dấu vết thời gian thực thông qua Loki và Tempo, đến các bảng điều khiển và cảnh báo trong Grafana, chúng tôi đã phác thảo cách xây dựng một vòng lặp phản hồi mã nguồn mở giúp làm nổi bật các vấn đề trước khi chúng trở thành sự cố ngừng hoạt động và biến mọi lần triển khai thành cơ hội để tinh chỉnh."
    },
    {
      "[y1, x1, y2, x2]": [923, 731, 935, 856],
      "text": "Kết luận 241"
    }
  ],
  "page_4": [
    {
      "[y1, x1, y2, x2]": [88, 142, 154, 856],
      "text": "Chúng ta đã khám phá các kỹ thuật thực tế như chế độ chạy ẩn, triển khai canary, ghi nhật ký dự phòng và theo dõi cảm tính của người dùng. Chúng ta đã nhấn mạnh không chỉ những gì cần đo lường mà còn cả cách hành động. Và chúng ta đã cho thấy việc giám sát giúp phát hiện không chỉ các lỗi mà cả những sự trôi dạt từ từ trong ngữ cảnh, dữ liệu hoặc hành vi có thể âm thầm làm suy yếu hiệu suất nếu không được kiểm soát."
    },
    {
      "[y1, x1, y2, x2]": [171, 142, 254, 856],
      "text": "Con đường phía trước rất rõ ràng: các đội xây dựng hệ thống tác tử với khả năng quan sát trong tâm trí—những người đo lường, trực quan hóa và học hỏi từ các tác tử của họ trong quá trình hoạt động—sẽ có được một lợi thế mạnh mẽ. Họ lặp lại nhanh hơn. Họ tin tưởng vào các chỉ số của mình. Họ khôi phục một cách suôn sẻ khi có sự cố."
    },
    {
      "[y1, x1, y2, x2]": [271, 142, 337, 856],
      "text": "Trong một thế giới nơi các hệ thống tác tử đang trở thành hạ tầng cốt lõi, việc giám sát mạnh mẽ không phải là tùy chọn—nó là nền tảng. Và những người làm chủ nó sẽ dẫn đầu trong việc tạo ra các tác tử thông minh, có khả năng phục hồi và đáng tin cậy ở quy mô lớn."
    },
    {
      "[y1, x1, y2, x2]": [923, 142, 935, 438],
      "text": "242 | Chương 10: Giám sát trong môi trường sản xuất"
    }
  ],
  "page_5": [
    {
      "[y1, x1, y2, x2]": [122, 725, 134, 856],
      "text": "CHƯƠNG 11"
    },
    {
      "[y1, x1, y2, x2]": [159, 528, 188, 856],
      "text": "Các vòng lặp cải tiến"
    },
    {
      "[y1, x1, y2, x2]": [369, 142, 521, 856],
      "text": "Trong bất kỳ hệ thống đa tác tử đủ phức tạp nào, thất bại không phải là một điều bất thường—nó là một điều không thể tránh khỏi. Các hệ thống này hoạt động trong các môi trường thực tế, năng động, tương tác với những người dùng đa dạng, các đầu vào không thể đoán trước và các nguồn dữ liệu bên ngoài thay đổi nhanh chóng. Ngay cả những hệ thống được thiết kế tốt nhất cũng sẽ gặp phải các trường hợp biên, các hướng dẫn mơ hồ và các hành vi phát sinh mà thiết kế ban đầu không lường trước được. Nhưng bài kiểm tra thực sự của một hệ thống không phải là liệu nó có thất bại hay không—mà là nó học hỏi từ những thất bại đó và cải thiện theo thời gian tốt đến mức nào. Chương này tập trung vào việc xây dựng các vòng lặp cải tiến dựa trên phản hồi cho phép các hệ thống tác tử không chỉ phục hồi sau thất bại mà còn phát triển và tự tinh chỉnh liên tục."
    },
    {
      "[y1, x1, y2, x2]": [538, 142, 831, 856],
      "text": "Cải tiến liên tục không phải là một cơ chế đơn lẻ mà là một chu trình liên kết của việc sử dụng các đường ống phản hồi để hỗ trợ chẩn đoán vấn đề, chạy thử nghiệm và học hỏi. Đầu tiên, các thất bại phải được quan sát, hiểu và phân loại thông qua các đường ống phản hồi làm nổi bật những thông tin chuyên sâu có thể hành động. Các đường ống này kết hợp phân tích tự động ở quy mô lớn với việc đánh giá có sự tham gia của con người để rút ra những kết luận có ý nghĩa từ dữ liệu đo từ xa thô và các tương tác của người dùng trong thế giới thực. Tiếp theo, các cải tiến được đề xuất phải được xác thực trong các môi trường được kiểm soát thông qua các khung thử nghiệm như triển khai ẩn, thử nghiệm A/B và Bayesian Bandits. Các kỹ thuật này cung cấp các con đường có cấu trúc để triển khai các thay đổi một cách tăng dần, giảm thiểu rủi ro trong khi tối đa hóa tác động. Cuối cùng, các cải tiến phải được nhúng vào hệ thống thông qua các cơ chế học tập liên tục, cho dù thông qua các điều chỉnh trong ngữ cảnh ngay lập tức hay việc huấn luyện lại ngoại tuyến định kỳ. Để hiểu được chu trình cải tiến liên tục này, việc đưa ra một phép so sánh từ học tăng cường là hữu ích, nơi các tác tử học được các hành vi tối ưu thông qua các tương tác lặp đi lặp lại với môi trường của chúng. Xem Hình 11-1."
    },
    {
      "[y1, x1, y2, x2]": [923, 833, 935, 856],
      "text": "243"
    }
  ],
  "page_6": [
    {
      "[y1, x1, y2, x2]": [81, 142, 244, 856],
      "image": null
    },
    {
      "[y1, x1, y2, x2]": [255, 142, 305, 856],
      "text": "Hình 11-1. Sự tương tác giữa một tác tử và môi trường của nó trong một hệ thống học tăng cường, cho thấy cách tác tử nhận các quan sát, thực hiện các hành động, và nhận phần thưởng và các quan sát mới từ môi trường."
    },
    {
      "[y1, x1, y2, x2]": [329, 142, 446, 856],
      "text": "Nhiều đội ngũ dựa vào các mô hình nền tảng đã được huấn luyện trước mà không trực tiếp huấn luyện các tác tử của họ và thường thiếu hoàn toàn các vòng lặp cải tiến có cấu trúc. Chương này khám phá cách lấp đầy khoảng trống đó bằng cách triển khai các cơ chế dựa trên phản hồi cho phép các tác tử thích ứng và tinh chỉnh theo thời gian dựa trên các tương tác trong thế giới thực với môi trường của chúng. Tinh chỉnh, như chúng ta đã thảo luận trong Chương 7, là một cách hiệu quả để khép lại vòng lặp này, nhưng trong chương này, chúng ta sẽ thảo luận về một loạt các kỹ thuật rộng hơn ngoài việc tinh chỉnh."
    },
    {
      "[y1, x1, y2, x2]": [463, 142, 597, 856],
      "text": "Tuy nhiên, cải tiến không hoàn toàn là một thách thức kỹ thuật—nó cũng là một thách thức về mặt tổ chức. Các vòng lặp cải tiến hiệu quả đòi hỏi sự thống nhất giữa các đội kỹ thuật, khoa học dữ liệu, quản lý sản phẩm và UX. Chúng đòi hỏi các hệ thống để ghi lại thông tin chuyên sâu, ưu tiên các cải tiến và bảo vệ chống lại các hậu quả không mong muốn. Quan trọng nhất, chúng đòi hỏi một văn hóa tò mò và lặp lại—một văn hóa xem mọi thất bại như một nguồn thông tin quý giá và mọi thành công như một nền tảng cho việc tinh chỉnh sâu hơn."
    },
    {
      "[y1, x1, y2, x2]": [614, 142, 748, 856],
      "text": "Chương này chia nhỏ việc cải tiến liên tục thành ba phần cốt lõi. Phần đầu tiên khám phá kiến trúc của các đường ống phản hồi, chi tiết cách thu thập, phân tích và ưu tiên các thông tin chuyên sâu từ cả các công cụ tự động và những người đánh giá là con người. Tiếp theo, tôi sẽ đi sâu vào các khung thử nghiệm, giải thích cách các kỹ thuật như triển khai ẩn và thử nghiệm A/B có thể xác thực các thay đổi được đề xuất trong các môi trường rủi ro thấp. Sau đó, tôi sẽ đề cập đến việc học tập liên tục, cho thấy cách các hệ thống có thể thích ứng một cách linh hoạt thông qua các chiến lược trong ngữ cảnh và các bản cập nhật ngoại tuyến định kỳ. Bảng 11-1 cung cấp một cái nhìn tổng quan về những gì chúng ta sẽ đề cập."
    },
    {
      "[y1, x1, y2, x2]": [923, 142, 935, 413],
      "text": "244 | Chương 11: Các vòng lặp cải tiến"
    }
  ],
  "page_7": [
    {
      "[y1, x1, y2, x2]": [81, 142, 393, 856],
      "table": [
        [
          "Kỹ thuật",
          "Mục đích",
          "Điểm mạnh",
          "Hạn chế",
          "Khi nào nên sử dụng"
        ],
        [
          "Các đường ống phản hồi",
          "Quan sát, phân tích và ưu tiên các vấn đề từ các tương tác để tạo ra các thông tin chuyên sâu có thể hành động",
          "Xử lý dữ liệu có thể mở rộng; kết hợp tự động hóa và sự giám sát của con người; phát hiện rủi ro chủ động; cơ sở cho các chu kỳ cải tiến",
          "Phụ thuộc vào chất lượng dữ liệu; có thể bỏ qua các vấn đề hoàn toàn mới nếu không có sự leo thang",
          "Để chẩn đoán các lỗi, phát hiện các mẫu, hoặc xây dựng danh sách các công việc cải tiến cần làm; phù hợp với các hệ thống phức tạp, khối lượng lớn"
        ],
        [
          "Thử nghiệm",
          "Xác thực các thay đổi trong môi trường được kiểm soát, đo lường tác động, và giảm rủi ro trước khi triển khai",
          "Dựa trên dữ liệu; giảm thiểu rủi ro; cho phép so sánh các biến thể; thích ứng với các điều kiện thực tế",
          "Cần đủ dữ liệu để có ý nghĩa thống kê; tốn nhiều tài nguyên; không phù hợp cho các trường hợp rủi ro cực cao nếu không có các cổng kiểm soát",
          "Để kiểm tra các cải tiến; lý tưởng cho các lần triển khai tăng dần, so sánh, hoặc các môi trường năng động cần phản hồi nhanh"
        ],
        [
          "Học tập liên tục",
          "Nhúng các thích ứng động dựa trên các tương tác và nhu cầu phát triển",
          "Khả năng thích ứng thời gian thực; giải quyết các thay đổi của người dùng; tăng cường khả năng phục hồi; hỗ trợ cá nhân hóa",
          "Rủi ro quá khớp/suy giảm; tốn kém về mặt tính toán; đòi hỏi giám sát mạnh mẽ",
          "Để thích ứng với các mẫu, cá nhân hóa, hoặc khắc phục các vấn đề mang tính hệ thống; tốt nhất trong các môi trường thay đổi nhanh chóng hoặc cho các điều chỉnh tức thời"
        ]
      ]
    },
    {
      "[y1, x1, y2, x2]": [410, 142, 460, 856],
      "text": "Cuối cùng, việc xây dựng một hệ thống tự cải tiến không chỉ là việc sửa chữa những gì bị hỏng—mà là việc thiết kế một luồng công việc nơi mọi thất bại, thông tin chuyên sâu và thử nghiệm đều trở thành nhiên liệu cho sự phát triển. Chương này cung cấp các công cụ, chiến lược và tư duy cần thiết để đảm bảo rằng các hệ thống tác tử thích ứng với hoàn cảnh thay đổi."
    },
    {
      "[y1, x1, y2, x2]": [514, 142, 534, 363],
      "text": "Các đường ống phản hồi"
    },
    {
      "[y1, x1, y2, x2]": [552, 142, 688, 856],
      "text": "Các đường ống phản hồi tự động là cần thiết để xử lý khối lượng và độ phức tạp khổng lồ của dữ liệu được tạo ra bởi các hệ thống đa tác tử hoạt động ở quy mô lớn. Các đường ống này đóng vai trò là tuyến phân tích đầu tiên, liên tục theo dõi các tương tác, phát hiện các mẫu lỗi và phân cụm các vấn đề để làm nổi bật các thông tin chuyên sâu có thể hành động. Bằng cách tận dụng các khung tối ưu hóa như DSPy (Các chương trình ngôn ngữ tự cải tiến theo lối khai báo), Trace của Microsoft và Tối ưu hóa lời nhắc tự động (APO), cùng với các công cụ quan sát, các hệ thống này có thể hoạt động với khả năng hiển thị chi tiết về hành vi của tác tử, việc sử dụng công cụ và các lộ trình ra quyết định đồng thời cho phép các tinh chỉnh tự động."
    },
    {
      "[y1, x1, y2, x2]": [705, 142, 822, 856],
      "text": "Chức năng cốt lõi của các đường ống phản hồi tự động là xác định một cách có hệ thống các vấn đề lặp lại trong các luồng công việc của tác tử. Ví dụ, các lỗi lặp đi lặp lại trong việc lựa chọn kỹ năng có thể cho thấy sự không phù hợp giữa ý định của người dùng và quá trình suy luận của tác tử, trong khi các lỗi nhất quán trong việc thực thi công cụ có thể tiết lộ sự mơ hồ trong cách các tham số công cụ được tạo ra. Các hệ thống tự động vượt trội trong việc nhận dạng mẫu trên các tập dữ liệu khổng lồ, phân cụm các trường hợp thất bại tương tự lại với nhau để làm cho các xu hướng trở nên rõ ràng và có thể hành động. Thay vì phụ thuộc vào các kỹ sư phải rà soát nhật ký và dấu vết thô, các hệ thống tự động"
    },
    {
      "[y1, x1, y2, x2]": [923, 684, 935, 856],
      "text": "Các đường ống phản hồi 245"
    }
  ],
  "page_8": [
    {
      "[y1, x1, y2, x2]": [88, 142, 121, 856],
      "text": "chắt lọc các mẫu này thành những thông tin chuyên sâu dễ hiểu, gắn cờ các vấn đề có tác động lớn để được chú ý ngay lập tức."
    },
    {
      "[y1, x1, y2, x2]": [138, 142, 255, 856],
      "text": "Hình 11-2 minh họa một vòng lặp tối ưu hóa lời nhắc tự động điển hình, được sử dụng bởi các khung như DSPy và APO. Trong quá trình này, một lời nhắc ban đầu được đưa vào một mô hình mục tiêu, mô hình này tạo ra các đầu ra được đánh giá dựa trên một tập dữ liệu bởi một mô hình đánh giá. Các điểm số kết quả cung cấp thông tin cho một mô hình tối ưu hóa, mô hình này tinh chỉnh lặp đi lặp lại và đề xuất các lời nhắc mới để cải thiện hiệu suất. Cách tiếp cận này cho phép các cải tiến liên tục, dựa trên dữ liệu mà không cần sự can thiệp thủ công, làm cho nó trở thành một nền tảng của các đường ống phản hồi có thể mở rộng trong các luồng công việc tác tử."
    },
    {
      "[y1, x1, y2, x2]": [270, 329, 513, 669],
      "image": null
    },
    {
      "[y1, x1, y2, x2]": [529, 142, 579, 856],
      "text": "Hình 11-2. Đường ống tối ưu hóa lời nhắc tự động, cho thấy luồng đi từ lời nhắc ban đầu qua các mô hình mục tiêu và đánh giá, với một mô hình tối ưu hóa tạo ra các lời nhắc được tinh chỉnh dựa trên các điểm số từ tập dữ liệu."
    },
    {
      "[y1, x1, y2, x2]": [596, 142, 889, 856],
      "text": "Các đường ống phản hồi tự động, được cung cấp bởi các công cụ như DSPy, Trace và APO, biến đổi dữ liệu quan sát thô thành các cải tiến lặp đi lặp lại, đảm bảo rằng các hệ thống đa tác tử vẫn mạnh mẽ và có khả năng thích ứng. Bây giờ chúng ta sẽ thảo luận chi tiết hơn về một số cách tiếp cận này. DSPy là một khung Python mã nguồn mở được phát triển bởi các nhà nghiên cứu tại Stanford NLP để tự động tối ưu hóa và cải thiện các hệ thống sử dụng các mô hình nền tảng. Không giống như kỹ thuật lời nhắc truyền thống, vốn dựa vào việc thử và sai thủ công, DSPy coi các đường ống mô hình ngôn ngữ (LM) như các chương trình khai báo, dạng mô-đun có thể được tinh chỉnh một cách có hệ thống bằng cách sử dụng dữ liệu. Các nhà phát triển định nghĩa các “chữ ký” (đặc tả đầu vào/đầu ra cho các tác vụ), kết hợp chúng thành các mô-đun (ví dụ: chuỗi tư duy hoặc ReAct để suy luận và sử dụng công cụ), và áp dụng các bộ tối ưu hóa (như BootstrapFewshot hoặc MIPROv2) để tự động tạo ra các lời nhắc tốt hơn và các ví dụ ít mẫu và thậm chí tinh chỉnh hành vi của mô hình dựa trên một tập dữ liệu các ví dụ và một chỉ số (ví dụ: khớp chính xác hoặc tương đồng ngữ nghĩa). Cách tiếp cận dựa trên dữ liệu này cho phép các vòng lặp tự cải tiến, nơi các thông tin chuyên sâu từ các mẫu lỗi được lan truyền ngược để tăng cường các lời nhắc, công cụ hoặc chiến lược suy luận—lý tưởng cho việc tối ưu hóa chủ động trong các hệ thống tác tử."
    },
    {
      "[y1, x1, y2, x2]": [923, 142, 935, 413],
      "text": "246 | Chương 11: Các vòng lặp cải tiến"
    }
  ],
  "page_9": [
    {
      "[y1, x1, y2, x2]": [88, 142, 121, 856],
      "text": "DSPy tích hợp với các API LM phổ biến (ví dụ: OpenAI, Anthropic) và hỗ trợ biên dịch đa giai đoạn cho các luồng công việc phức tạp."
    },
    {
      "[y1, x1, y2, x2]": [138, 142, 255, 856],
      "text": "Bổ sung cho DSPy, Trace của Microsoft là một khung mã nguồn mở để tối ưu hóa tạo sinh các hệ thống AI. Nó cho phép huấn luyện và tinh chỉnh toàn diện các tác tử AI sử dụng các tín hiệu phản hồi chung (ví dụ: điểm số, các phê bình bằng ngôn ngữ tự nhiên, hoặc các sở thích theo cặp) thay vì yêu cầu gradient hoặc các mục tiêu khả vi. Bằng cách coi việc tối ưu hóa như một quá trình tạo sinh, Trace sử dụng một mô hình nền tảng để đề xuất và đánh giá các cải tiến một cách lặp đi lặp lại, làm cho nó phù hợp với các hệ thống hộp đen nơi các phương pháp truyền thống không hiệu quả. Điều này đặc biệt hữu ích để tinh chỉnh các hành vi của tác tử trong các môi trường năng động, đa bước, chẳng hạn như kết hợp phản hồi từ các lỗi được phân cụm để phát triển các chiến lược suy luận hoặc các lệnh gọi công cụ theo thời gian."
    },
    {
      "[y1, x1, y2, x2]": [272, 142, 355, 856],
      "text": "Để minh họa các khái niệm trong phần này, chúng ta sẽ sử dụng một ví dụ xuyên suốt về một tác tử phân tích viên Trung tâm Điều hành An ninh (SOC) được xây dựng với LangGraph. Tác tử này xử lý các tác vụ an ninh mạng như điều tra các mối đe dọa, phân tích nhật ký và phân loại sự cố. Các thành phần cốt lõi của nó bao gồm một lời nhắc hệ thống hướng dẫn phương pháp luận của tác tử, các công cụ cho các hành động như truy vấn nhật ký hoặc cô lập máy chủ, và một luồng công việc gọi một mô hình nền tảng (ví dụ: GPT-5) được gắn với các công cụ đó. Đây là một đoạn trích đơn giản hóa của lời nhắc hệ thống và định nghĩa công cụ của tác tử:"
    },
    {
      "[y1, x1, y2, x2]": [372, 176, 769, 856],
      "text": "Bạn là một phân tích viên Trung tâm Điều hành An ninh (SOC) có kinh nghiệm, chuyên về phản ứng sự cố an ninh mạng.\nChuyên môn của bạn bao gồm:\nPhân tích thông tin tình báo về mối đe dọa và nghiên cứu IOC\nPhân tích và tương quan nhật ký bảo mật trên nhiều hệ thống\nPhân loại và xếp hạng sự cố (dương tính thật/dương tính giả)\nPhân tích phần mềm độc hại và săn lùng mối đe dọa\nGiám sát an ninh mạng và phát hiện bất thường\nNgăn chặn sự cố và điều phối phản ứng\nVận hành nền tảng SIEM/SOAR\nPhương pháp luận điều tra của bạn:\n1) Phân tích các cảnh báo bảo mật và thu thập các chỉ số ban đầu\n2) Sử dụng lookup_threat_intel để nghiên cứu IP, hash, URL và tên miền\n3) Sử dụng query_logs để tìm kiếm các nguồn nhật ký liên quan để tìm bằng chứng\n4) Sử dụng triage_incident để phân loại các phát hiện là dương tính thật/giả\n5) Sử dụng isolate_host khi cần ngăn chặn để tránh lây lan\n6) Tiếp theo là send_analyst_response để ghi lại các phát hiện\nLuôn ưu tiên ngăn chặn mối đe dọa nhanh chóng và phân loại sự cố chính xác."
    },
    {
      "[y1, x1, y2, x2]": [786, 142, 799, 499],
      "text": "Tác tử của chúng ta có một số công cụ được định nghĩa ở đây:"
    },
    {
      "[y1, x1, y2, x2]": [816, 176, 903, 712],
      "code": "@tool\ndef lookup_threat_intel(indicator: str, type: str, **kwargs) -> str:\n\"\"\"Tra cứu thông tin tình báo về mối đe dọa cho các địa chỉ IP, hash tệp,\nURL và tên miền.\"\"\"\nprint(f'''[CÔNG CỤ] lookup_threat_intel(indicator={indicator},"
    },
    {
      "[y1, x1, y2, x2]": [923, 684, 935, 856],
      "text": "Các đường ống phản hồi | 247"
    }
  ],
  "page_10": [
    {
      "[y1, x1, y2, x2]": [88, 176, 781, 856],
      "code": "type={type}, kwargs={kwargs})''')\nlog_to_loki(\"tool.lookup_threat_intel\", f\"indicator={indicator}, type={type}\")\nreturn \"threat_intel_retrieved\"\n@tool\ndef query_logs (query: str, log_index: str, **kwargs) -> str:\n\"\"\"Tìm kiếm và phân tích nhật ký bảo mật trên các hệ thống xác thực, điểm cuối, mạng,\ntường lửa và DNS.\n\"\"\"\nprint(f\"[CÔNG CỤ] query_logs(query={query}, log_index={log_index},\nkwargs={kwargs})\")\nlog_to_loki(\"tool.query_logs\", f\"query={query}, log_index={log_index}\")\nreturn \"log_query_executed\"\n@tool\ndef triage_incident(incident_id: str, decision: str, reason: str, **kwargs):\n\"\"\"Phân loại các sự cố bảo mật là dương tính thật, dương tính giả, hoặc leo thang\nđể điều tra thêm.\"\"\"\nprint(f'''[CÔNG CỤ] triage_incident(incident_id={incident_id},\ndecision={decision}, reason={reason},\nkwargs={kwargs})''')\nlog_to_loki(\"tool.triage_incident\", f\"incident_id={incident_id},\ndecision={decision}\")\nreturn \"incident_triaged\"\n@tool\ndef isolate_host(host_id: str, reason: str, **kwargs) -> str:\n\"\"\"Cô lập các máy chủ bị xâm nhập để ngăn chặn sự di chuyển ngang\nvà ngăn chặn các sự cố bảo mật.\"\"\"\nprint(f\"[CÔNG CỤ] isolate_host(host_id={host_id}, reason={reason},\nkwargs={kwargs})\")\nlog_to_loki(\"tool.isolate_host\", f\"host_id={host_id}, reason={reason}\")\nreturn \"host_isolated\"\n@tool\ndef send_analyst_response(incident_id: str = None, message: str = None) -> str:\n\"\"\"Gửi các phân tích bảo mật, cập nhật sự cố, hoặc các khuyến nghị đến\ncác bên liên quan.\"\"\"\nprint(f\"[CÔNG CỤ] send_analyst_response → {message}\")\nlog_to_loki(\"tool.send_analyst_response\", f\"incident_id={incident_id},\nmessage={message}\")\nreturn \"analyst_response_sent\"\nTOOLS = [\nlookup_threat_intel, query_logs, triage_incident, isolate_host,\nsend_analyst_response\n]"
    },
    {
      "[y1, x1, y2, x2]": [798, 142, 898, 856],
      "text": "Trong một triển khai thực tế, tác tử này xử lý các cảnh báo như \"Nỗ lực đăng nhập đáng ngờ từ IP 203.0.113.45.” Theo thời gian, khi các mối đe dọa phát triển (ví dụ: các vector tấn công mới xuất hiện), các truy vấn của người dùng thay đổi, hoặc các nguồn dữ liệu bên ngoài thay đổi, tác tử có thể gặp phải các lỗi—chẳng hạn như diễn giải sai các truy vấn, chọn các công cụ không tối ưu, hoặc tạo ra các phân loại không chính xác. Đây là lúc các đường ống phản hồi phát huy tác dụng: chúng phát hiện các vấn đề này, phân tích nguyên nhân gốc rễ"
    },
    {
      "[y1, x1, y2, x2]": [923, 142, 935, 413],
      "text": "248 | Chương 11: Các vòng lặp cải tiến"
    }
  ],
  "page_11": [
    {
      "[y1, x1, y2, x2]": [88, 142, 171, 856],
      "text": "và thúc đẩy các cải tiến. Ví dụ, “sự trôi dạt” có thể xảy ra nếu lời nhắc của tác tử giả định các mẫu mối đe dọa lỗi thời (ví dụ: tập trung vào các lần đăng nhập dựa trên IP khi kẻ tấn công chuyển sang nhồi thông tin đăng nhập), dẫn đến các trường hợp âm tính giả lặp đi lặp lại. Các kỹ sư con người có thể khắc phục điều này bằng cách tinh chỉnh các lời nhắc để bao gồm các ví dụ cập nhật hoặc thêm các bước xác thực trong các công cụ."
    },
    {
      "[y1, x1, y2, x2]": [188, 142, 305, 856],
      "text": "Các đường ống phản hồi tự động là cần thiết để xử lý khối lượng và độ phức tạp khổng lồ của dữ liệu được tạo ra bởi các hệ thống đa tác tử hoạt động ở quy mô lớn. Các đường ống này đóng vai trò là tuyến phân tích đầu tiên, liên tục theo dõi các tương tác, phát hiện các mẫu lỗi và phân cụm các vấn đề để làm nổi bật các thông tin chuyên sâu có thể hành động. Bằng cách tận dụng các công cụ quan sát như Trace, DSPy và các khung tương tự, các hệ thống này có thể hoạt động với khả năng hiển thị chi tiết về hành vi của tác tử, việc sử dụng công cụ và các lộ trình ra quyết định."
    },
    {
      "[y1, x1, y2, x2]": [322, 142, 456, 856],
      "text": "Một trong những khả năng mạnh mẽ nhất của các công cụ phản hồi hiện đại là khả năng lan truyền ngược phản hồi dựa trên văn bản trực tiếp vào các lời nhắc, các tham số kỹ năng và các chiến lược suy luận của hệ thống. Ví dụ, nếu phân tích cho thấy rằng một số hướng dẫn tác vụ nhất định thường dẫn đến các đầu ra mơ hồ, đường ống có thể đề xuất các cải tiến cho các lời nhắc liên quan—diễn đạt chặt chẽ hơn, điều chỉnh các ràng buộc, hoặc sắp xếp lại các bước trong quá trình suy luận. Tương tự, nếu các lệnh gọi công cụ liên tục thất bại do các tham số bị sai định dạng, các hệ thống tự động có thể đề xuất các điều chỉnh về cách các tham số đó được xây dựng, bao gồm việc giới thiệu các bước xác thực hoặc các phương án dự phòng động."
    },
    {
      "[y1, x1, y2, x2]": [473, 142, 573, 856],
      "text": "Ngoài các cải tiến mang tính phản ứng, các đường ống tự động cũng hỗ trợ tối ưu hóa chủ động. Bằng cách liên tục phân tích dữ liệu đầu vào, chúng có thể làm nổi bật các khu vực có rủi ro tiềm ẩn trước khi chúng biểu hiện thành các lỗi nghiêm trọng. Ví dụ, việc phát hiện sớm sự trôi dạt trong các mẫu truy vấn của người dùng có thể kích hoạt các điều chỉnh lời nhắc để đảm bảo các tác tử luôn phù hợp với các kỳ vọng của người dùng đang thay đổi. Những thông tin chuyên sâu chủ động này cho phép các đội giải quyết các vấn đề tiềm tàng trước khi chúng lan rộng thành các vấn đề lớn hơn."
    },
    {
      "[y1, x1, y2, x2]": [590, 142, 707, 856],
      "text": "Tuy nhiên, các đường ống tự động không phải là không thể sai lầm. Mặc dù chúng vượt trội trong việc xác định các mẫu và đề xuất các thay đổi, chúng không thể tính toán đầy đủ cho các sắc thái ngữ cảnh hoặc ưu tiên các cải tiến dựa trên các mục tiêu chiến lược rộng lớn hơn. Đây là lúc sự giám sát của con người trở nên quan trọng—các kỹ sư phải xem xét, xác thực và, khi cần thiết, ghi đè các đề xuất được đưa ra bởi các hệ thống này. Do đó, các đường ống tự động không đóng vai trò thay thế cho sự sáng suốt của con người mà là những bộ khuếch đại mạnh mẽ, cho phép các kỹ sư tập trung chuyên môn của họ vào những nơi quan trọng nhất."
    },
    {
      "[y1, x1, y2, x2]": [724, 142, 824, 856],
      "text": "Về bản chất, các đường ống phản hồi tự động tạo ra một vòng lặp tự cải tiến có thể mở rộng: chúng quan sát, phân cụm, phân tích và đề xuất các cải tiến trên các lời nhắc, công cụ và các luồng suy luận. Bằng cách quản lý hiệu quả dữ liệu về các lỗi và tạo ra các thông tin chuyên sâu có thể hành động, các hệ thống này tạo thành nền tảng của một chu kỳ phát triển dựa trên phản hồi mạnh mẽ, trao quyền cho các hệ thống đa tác tử thích ứng và phát triển liên tục để đáp ứng các yêu cầu của thế giới thực."
    },
    {
      "[y1, x1, y2, x2]": [923, 684, 935, 856],
      "text": "Các đường ống phản hồi 249"
    }
  ],
  "page_12": [
    {
      "[y1, x1, y2, x2]": [81, 142, 101, 720],
      "text": "Phát hiện vấn đề và phân tích nguyên nhân gốc rễ tự động"
    },
    {
      "[y1, x1, y2, x2]": [119, 142, 170, 856],
      "text": "Khi các hệ thống tác tử ngày càng phức tạp, việc giám sát và gỡ lỗi thủ công nhanh chóng trở nên không thể mở rộng. Việc phát hiện vấn đề và phân tích nguyên nhân gốc rễ (RCA) tự động là cần thiết để xác định và chẩn đoán các vấn đề với tốc độ và quy mô lớn."
    },
    {
      "[y1, x1, y2, x2]": [187, 142, 287, 856],
      "text": "Trong ví dụ về tác tử SOC của chúng ta, hãy tưởng tượng hệ thống xử lý hàng trăm cảnh báo mỗi ngày. Việc phát hiện tự động có thể gắn cờ một sự tăng đột biến trong các lệnh gọi query_logs thất bại trong đó tham số truy vấn bị sai định dạng (ví dụ: do tác tử tạo ra các truy vấn giống SQL quá phức tạp mà backend không thể phân tích cú pháp). Sử dụng các công cụ như Trace, đường ống ghi lại mỗi lệnh gọi, phân cụm các lỗi tương tự (ví dụ: “cú pháp truy vấn không hợp lệ”), và tương quan chúng với các bước suy luận trước đó trong lời nhắc của tác tử."
    },
    {
      "[y1, x1, y2, x2]": [304, 142, 354, 856],
      "text": "Việc phát hiện vấn đề tự động tận dụng sự kết hợp của các trình kích hoạt dựa trên quy tắc, các thuật toán phát hiện bất thường và phân cụm thống kê để sàng lọc qua khối lượng nhật ký và sự kiện khổng lồ. Các hệ thống này có thể gắn cờ một số mẫu nhất định:"
    },
    {
      "[y1, x1, y2, x2]": [371, 159, 454, 856],
      "list": [
        "Các lỗi lặp đi lặp lại trong một kỹ năng hoặc công cụ cụ thể",
        "Sự tăng đột biến trong tỷ lệ lỗi hoặc thời gian phản hồi",
        "Các bất thường trong các chỉ số tương tác hoặc sự hài lòng của người dùng",
        "Hành vi khác biệt giữa các phiên bản tác tử hoặc môi trường triển khai"
      ]
    },
    {
      "[y1, x1, y2, x2]": [471, 142, 521, 856],
      "text": "Các đường ống phản hồi hiện đại thường sử dụng các kỹ thuật ML hoặc thống kê để phát hiện các xu hướng tinh vi mà nếu không có thể không được chú ý—chẳng hạn như sự trôi dạt dần dần trong các mẫu quyết định của tác tử, hoặc các mối tương quan giữa các đầu vào cụ thể của người dùng và các lỗi sau đó."
    },
    {
      "[y1, x1, y2, x2]": [538, 142, 621, 856],
      "text": "Một khi một vấn đề được phát hiện, RCA tìm cách trả lời không chỉ điều gì đã thất bại, mà còn tại sao. RCA không chỉ là việc gỡ lỗi sau sự cố; nó là một quá trình tìm hiểu liên tục, lặp đi lặp lại về các mối quan hệ giữa ý định của người dùng, suy luận của tác tử, kiến trúc hệ thống và môi trường bên ngoài. RCA hiệu quả thường tuân theo một số bước:"
    },
    {
      "[y1, x1, y2, x2]": [638, 142, 685, 856],
      "text": "Truy vết luồng công việc\nTái tạo chuỗi quyết định, các lệnh gọi công cụ và các tương tác của người dùng từ đầu đến cuối dẫn đến sự cố."
    },
    {
      "[y1, x1, y2, x2]": [702, 142, 765, 856],
      "text": "Định vị lỗi\nCô lập thành phần chính xác—chẳng hạn như một lời nhắc bị diễn giải sai, một lựa chọn kỹ năng không phù hợp, hoặc một công cụ với logic tham số hạn chế—chịu trách nhiệm cho sự cố."
    },
    {
      "[y1, x1, y2, x2]": [782, 142, 832, 856],
      "text": "Nhận dạng mẫu\nXác định xem sự cố là một sự cố đơn lẻ hay là một phần của một xu hướng lặp lại, có khả năng liên quan đến các nhóm người dùng, các đầu vào dữ liệu hoặc các trạng thái hệ thống cụ thể."
    },
    {
      "[y1, x1, y2, x2]": [923, 142, 935, 413],
      "text": "250 | Chương 11: Các vòng lặp cải tiến"
    }
  ],
  "page_13": [
    {
      "[y1, x1, y2, x2]": [88, 142, 118, 735],
      "text": "Đánh giá tác động\nĐánh giá tần suất và mức độ nghiêm trọng của vấn đề để ưu tiên phản ứng."
    },
    {
      "[y1, x1, y2, x2]": [135, 142, 218, 856],
      "text": "Điều quan trọng là, RCA trong các hệ thống tác tử thường tiết lộ rằng các lỗi không hoàn toàn là do kỹ thuật—chúng có thể bắt nguồn từ các định nghĩa tác vụ mơ hồ, các lỗ hổng trong dữ liệu huấn luyện, hoặc các kỳ vọng của người dùng đang thay đổi mà hệ thống không được thiết kế để xử lý. Trong một số trường hợp, RCA phát hiện ra các điểm mù của tổ chức, chẳng hạn như các chỉ số thành công khuyến khích các hành vi sai lầm hoặc các luồng công việc không còn phù hợp với nhu cầu của người dùng."
    },
    {
      "[y1, x1, y2, x2]": [235, 142, 335, 856],
      "text": "RCA có thể hành động không chỉ là đổ lỗi; nó làm nổi bật các cơ hội để cải thiện hệ thống một cách có ý nghĩa—cho dù thông qua việc tinh chỉnh lời nhắc hoặc công cụ, thay đổi điều phối kỹ năng, hoặc thậm chí suy nghĩ lại về cách biểu diễn và truyền đạt nhu cầu của người dùng.\nMột đường ống phản hồi mạnh mẽ, được neo giữ bởi việc phát hiện vấn đề và RCA tự động, chuyển các đội từ việc phân loại sự cố không hồi kết sang một quy trình có kỷ luật, dựa trên thông tin chuyên sâu, nơi mọi thất bại đều được khai thác để học hỏi. Đó là bước đầu tiên trong việc biến dữ liệu đo từ xa thành sự chuyển đổi—đặt nền móng cho tất cả các chu kỳ thử nghiệm và học tập liên tục sau này trong các hệ thống tác tử."
    },
    {
      "[y1, x1, y2, x2]": [352, 142, 372, 452],
      "text": "Đánh giá có sự tham gia của con người"
    },
    {
      "[y1, x1, y2, x2]": [390, 142, 507, 856],
      "text": "Mặc dù các hệ thống tự động vượt trội trong việc gắn cờ các bất thường và làm nổi bật các mẫu lặp lại trong các luồng công việc đa tác tử, vẫn còn nhiều tình huống mà chỉ phân tích tự động là không đủ. Một số vấn đề—đặc biệt là những vấn đề liên quan đến ý định người dùng mơ hồ, các sắc thái đạo đức, các mục tiêu xung đột, hoặc các trường hợp biên mới lạ—đòi hỏi trực giác của con người, chuyên môn trong lĩnh vực, và phán đoán theo ngữ cảnh. Đánh giá có sự tham gia của con người (HITL) đóng vai trò là một sự bổ sung quan trọng cho việc phát hiện và RCA tự động, đảm bảo rằng các đường ống phản hồi vẫn hiệu quả, toàn diện, và phù hợp với các mục tiêu tổ chức rộng lớn hơn."
    },
    {
      "[y1, x1, y2, x2]": [524, 142, 624, 856],
      "text": "Đối với tác tử SOC, HITL có thể leo thang các trường hợp mà RCA tự động gắn cờ các phân loại mơ hồ (ví dụ: một “đăng nhập đáng ngờ” có thể là một dương tính giả từ một mạng riêng ảo hoặc một vụ xâm nhập thực sự). Một kỹ sư bảo mật xem xét dấu vết, xác thực cách diễn giải của lời nhắc, và quyết định các bản sửa lỗi như thêm các nguyên tắc đạo đức vào lời nhắc (ví dụ: “Tránh cô lập các máy chủ mà không xác nhận tác động đến các hoạt động quan trọng”)."
    },
    {
      "[y1, x1, y2, x2]": [641, 142, 758, 856],
      "text": "Hình 11-3 mô tả một luồng công việc đánh giá HITL, trong đó dữ liệu đầu vào được xử lý bởi một tác tử để tạo ra các ứng viên đầu ra. Các ứng viên này trải qua sự đánh giá của một người đánh giá là con người, người cung cấp phản hồi thủ công để tinh chỉnh hoặc phê duyệt chúng, dẫn đến các đầu ra được con người phê duyệt được cung cấp cho người dùng cuối. Phản hồi hệ thống từ quá trình đánh giá được lặp lại để nâng cao hiệu suất của tác tử, đảm bảo sự phù hợp với các yêu cầu phức tạp mà chỉ tự động hóa không thể xử lý. Cấu trúc này"
    },
    {
      "[y1, x1, y2, x2]": [923, 684, 935, 856],
      "text": "Các đường ống phản hồi 251"
    }
  ],
  "page_14": [
    {
      "[y1, x1, y2, x2]": [88, 142, 121, 856],
      "text": "nhấn mạnh sự tích hợp của phán đoán của con người để giải quyết những sự mơ hồ và các quyết định có tính rủi ro cao, như đã thấy trong việc leo thang của tác tử SOC để đánh giá các mối đe dọa phức tạp."
    },
    {
      "[y1, x1, y2, x2]": [129, 187, 228, 811],
      "image": null
    },
    {
      "[y1, x1, y2, x2]": [239, 142, 289, 856],
      "text": "Hình 11-3. Luồng công việc đánh giá HITL, trong đó dữ liệu đầu vào chảy qua một tác tử tạo ra các ứng viên đầu ra, đến sự đánh giá của con người với phản hồi thủ công, kết thúc bằng các đầu ra được phê duyệt cho người dùng cuối được hỗ trợ bởi các vòng lặp phản hồi của hệ thống."
    },
    {
      "[y1, x1, y2, x2]": [306, 142, 406, 856],
      "text": "Đánh giá HITL không chỉ là một lưới an toàn cho tự động hóa; nó là một quy trình leo thang có cấu trúc đưa phán đoán của con người vào các vấn đề hệ thống phức tạp, mơ hồ, hoặc có tác động lớn nhất. Các đường ống tự động gắn cờ các sự cố vượt quá các ngưỡng được xác định trước, thể hiện các mẫu không giải thích được, hoặc có các xung đột chưa được giải quyết—sau đó chúng được chuyển đến để con người đánh giá. Các tiêu chí leo thang có thể bao gồm:"
    },
    {
      "[y1, x1, y2, x2]": [423, 159, 506, 739],
      "list": [
        "Các lỗi dai dẳng không có giải thích kỹ thuật rõ ràng",
        "Các bất thường trong các luồng công việc có tác động về quy định hoặc đạo đức",
        "Các lỗi trong các tác vụ có giá trị cao hoặc quan trọng",
        "Các khuyến nghị hoặc chẩn đoán xung đột từ các công cụ tự động"
      ]
    },
    {
      "[y1, x1, y2, x2]": [523, 142, 770, 856],
      "text": "Để tìm ra sự cân bằng đúng đắn giữa việc ra quyết định của con người và AI—đảm bảo con người tập trung vào các can thiệp có giá trị cao mà không bị quá tải—việc leo thang nên ưu tiên các trường hợp có độ chắc chắn của mô hình thấp nhất hoặc các kết quả có hậu quả lớn nhất. Đối với các trường hợp có độ chắc chắn thấp, hãy tích hợp các điểm tin cậy trực tiếp vào đầu ra của tác tử: nhiều mô hình nền tảng (ví dụ: GPT-5) có thể xuất ra một điểm chắc chắn tự đánh giá (0–1) cùng với các phản hồi bằng cách bao gồm các hướng dẫn như “Kết thúc phản hồi của bạn bằng: độ chắc chắn: [điểm 0–1 dựa trên sự tự tin về độ chính xác].” Các ngưỡng có thể được đặt ra (ví dụ: leo thang nếu độ chắc chắn < 0.7), hoặc sử dụng các thước đo entropy trên các đầu ra xác suất (ví dụ: entropy cao trong các logit phân loại cho thấy sự mơ hồ). Sự thay đổi giữa nhiều lần chạy (ví dụ: tổ hợp 3–5 suy luận và leo thang nếu các đầu ra phân kỳ > 20%) hoặc các bộ đánh giá bên ngoài (ví dụ: một mô hình nền tảng thứ cấp đánh giá sự mạch lạc) có thể lượng hóa thêm sự không chắc chắn. Trong tác tử SOC, các phân loại có độ chắc chắn thấp (ví dụ: một phân loại mối đe dọa với điểm < 0.8) có thể tự động leo thang để xem xét, lọc ra các trường hợp thông thường có độ tin cậy cao."
    },
    {
      "[y1, x1, y2, x2]": [787, 142, 853, 856],
      "text": "Đối với các trường hợp có hậu quả lớn, hãy đánh giá tác động dựa trên mức độ nghiêm trọng theo lĩnh vực cụ thể: trong tác tử SOC, hãy gắn cờ các sự cố có xếp hạng mức độ nghiêm trọng “cao” (ví dụ: các vụ rò rỉ dữ liệu tiềm tàng) hoặc những sự cố ảnh hưởng đến các tài sản quan trọng (ví dụ: tài khoản quản trị). Kết hợp điều này với việc chấm điểm rủi ro—ví dụ: nhân sự không chắc chắn với hậu quả (leo thang nếu điểm > ngưỡng)—để"
    },
    {
      "[y1, x1, y2, x2]": [923, 142, 935, 413],
      "text": "252 | Chương 11: Các vòng lặp cải tiến"
    }
  ],
  "page_15": [
    {
      "[y1, x1, y2, x2]": [88, 142, 188, 856],
      "text": "ưu tiên. Các công cụ như DSPy có thể tối ưu hóa các ngưỡng này ngoại tuyến bằng cách sử dụng dữ liệu lịch sử, mô phỏng tỷ lệ leo thang để cân bằng tải (ví dụ: nhắm đến < 10% các trường hợp được leo thang để tránh sự mệt mỏi của con người). Cách tiếp cận kết hợp này đảm bảo AI xử lý phần lớn các quyết định thông thường trong khi con người can thiệp vào những nơi cần phán đoán nhất, thúc đẩy các hệ thống đáng tin cậy, có thể mở rộng. Bằng cách xác định các trình kích hoạt leo thang rõ ràng, các đội ngăn chặn các hệ thống tự động thực hiện các can thiệp không phù hợp hoặc thiển cận và đảm bảo rằng các trường hợp phức tạp nhận được sự chú ý xứng đáng."
    },
    {
      "[y1, x1, y2, x2]": [205, 142, 255, 856],
      "text": "Khi một trường hợp được leo thang, một đội ngũ đánh giá đa ngành—thường bao gồm các kỹ sư, quản lý sản phẩm, nhà khoa học dữ liệu và các chuyên gia UX—sẽ phân tích một cách có hệ thống vấn đề được gắn cờ. Quá trình đánh giá thường bao gồm những điều sau:"
    },
    {
      "[y1, x1, y2, x2]": [272, 142, 319, 856],
      "text": "Phân tích theo ngữ cảnh\nTái tạo lại sự cố hoặc bất thường trong một môi trường được kiểm soát để hiểu được chuỗi sự kiện và các điểm quyết định."
    },
    {
      "[y1, x1, y2, x2]": [336, 142, 383, 856],
      "text": "Kiểm tra dấu vết\nKiểm tra nhật ký, dấu vết và các chuỗi quyết định để làm rõ cách tác tử diễn giải ý định của người dùng và lựa chọn các hành động."
    },
    {
      "[y1, x1, y2, x2]": [400, 142, 447, 856],
      "text": "Đánh giá tác động\nĐánh giá phạm vi và mức độ nghiêm trọng của vấn đề, xem xét cả tính đúng đắn về mặt kỹ thuật và UX."
    },
    {
      "[y1, x1, y2, x2]": [464, 142, 544, 856],
      "text": "Thiết kế giải pháp\nĐề xuất các can thiệp có mục tiêu—từ việc tinh chỉnh lời nhắc đến thiết kế lại luồng công việc, phát triển kỹ năng mới, hoặc thậm chí thay đổi các tính năng hướng tới người dùng. Trong ví dụ SOC, nếu sự trôi dạt gây ra việc cô lập quá mức các máy chủ, con người có thể khắc phục bằng cách cập nhật công cụ isolate_host để bao gồm một bước xác nhận."
    },
    {
      "[y1, x1, y2, x2]": [561, 142, 627, 856],
      "text": "Các quy trình đánh giá HITL hiệu quả nhấn mạnh việc tài liệu hóa và khả năng tái tạo. Các quyết định được ghi lại, các lý do được ghi nhận, và các kết quả được theo dõi để đảm bảo rằng các sự cố trong tương lai có thể được giải quyết hiệu quả hơn và các vấn đề mang tính hệ thống được xác định theo thời gian."
    },
    {
      "[y1, x1, y2, x2]": [644, 142, 744, 856],
      "text": "Đánh giá HITL thường được hưởng lợi từ các góc nhìn đa dạng ngoài kỹ thuật thuần túy. Các quản lý sản phẩm có thể làm rõ liệu sự cố quan sát được có phản ánh một sự lệch pha sâu sắc hơn với nhu cầu của người dùng hay không. Các nhà khoa học dữ liệu có thể nhận ra các mẫu hoặc các trường hợp biên mà người khác không nhìn thấy. Các nhà nghiên cứu UX có thể làm nổi bật các điểm gây khó khăn trong các tương tác của người dùng mà các chỉ số tự động có thể bỏ lỡ. Cách tiếp cận hợp tác này đảm bảo rằng các cải tiến không chỉ đúng về mặt kỹ thuật mà còn có ý nghĩa và giá trị đối với người dùng cuối."
    },
    {
      "[y1, x1, y2, x2]": [761, 142, 861, 856],
      "text": "Giá trị cuối cùng của việc đánh giá HITL nằm ở sự đóng góp của nó vào việc học hỏi trong tổ chức. Mỗi trường hợp được đánh giá trở thành một điểm dữ liệu trong một cơ sở kiến thức không ngừng phát triển—một tài liệu tham khảo để đào tạo các thành viên mới trong đội, cung cấp thông tin cho thiết kế hệ thống, và tinh chỉnh các vòng lặp phản hồi. Các bài học kinh nghiệm được đưa trở lại vào việc tinh chỉnh lời nhắc và công cụ, kỹ năng"
    },
    {
      "[y1, x1, y2, x2]": [923, 684, 935, 856],
      "text": "Các đường ống phản hồi | 253"
    }
  ],
  "page_16": [
    {
      "[y1, x1, y2, x2]": [88, 142, 121, 856],
      "text": "phát triển, và tài liệu hệ thống, giảm thiểu sự tái diễn của các lỗi tương tự trong tương lai."
    },
    {
      "[y1, x1, y2, x2]": [138, 142, 204, 856],
      "text": "Bằng cách cân bằng giữa tự động hóa và sự giám sát của con người, việc đánh giá HITL đảm bảo rằng các hệ thống đa tác tử vẫn vừa có thể mở rộng vừa đáng tin cậy. Nó biến các đường ống phản hồi từ các cơ chế sửa lỗi đơn thuần thành các động cơ của sự sáng suốt, khả năng phục hồi và cải tiến liên tục."
    },
    {
      "[y1, x1, y2, x2]": [221, 142, 241, 479],
      "text": "Tinh chỉnh lời nhắc và công cụ"
    },
    {
      "[y1, x1, y2, x2]": [259, 142, 359, 856],
      "text": "Một khi các đường ống phản hồi và các đánh giá HITL đã làm nổi bật các thông tin chuyên sâu có thể hành động, bước tiếp theo là thực hiện các cải tiến có mục tiêu. Trong các hệ thống tác tử, các đòn bẩy trực tiếp và có tác động nhất để tinh chỉnh hệ thống là việc thiết kế các lời nhắc (các hướng dẫn và ngữ cảnh được cung cấp cho các mô hình ngôn ngữ) và việc xây dựng và gọi các công cụ bên ngoài (các hàm, API, và các hành động mà tác tử có thể sử dụng), do đó việc tinh chỉnh lời nhắc có thể là một cách rất hiệu quả để cải thiện hiệu suất tổng thể."
    },
    {
      "[y1, x1, y2, x2]": [376, 142, 390, 319],
      "text": "Tinh chỉnh lời nhắc"
    },
    {
      "[y1, x1, y2, x2]": [407, 142, 457, 856],
      "text": "Các lời nhắc là cầu nối giữa ý định của người dùng và hành động của tác tử. Những thay đổi tinh vi trong cách diễn đạt, cấu trúc, hoặc ngữ cảnh của lời nhắc có thể ảnh hưởng đáng kể đến cách diễn giải, suy luận, và đầu ra của một tác tử. Các vòng lặp phản hồi thường tiết lộ các vấn đề như:"
    },
    {
      "[y1, x1, y2, x2]": [474, 159, 557, 784],
      "list": [
        "Các hướng dẫn mơ hồ dẫn đến các phản hồi không nhất quán hoặc không liên quan",
        "Các lời nhắc quá rộng gây ra ảo giác hoặc các đầu ra lạc đề",
        "Các lời nhắc cứng nhắc, hẹp không thể khái quát hóa cho sự biến đổi của thế giới thực",
        "Thiếu sự rõ ràng về ranh giới tác vụ, leo thang, hoặc xử lý lỗi"
      ]
    },
    {
      "[y1, x1, y2, x2]": [574, 142, 624, 856],
      "text": "Việc tinh chỉnh bắt đầu bằng phân tích: xem xét các lần thực hiện sai, truy vết suy luận của tác tử, và cô lập phần nào của lời nhắc đã góp phần vào các kết quả không mong muốn. Các cải tiến có thể bao gồm:"
    },
    {
      "[y1, x1, y2, x2]": [641, 142, 688, 856],
      "text": "Viết lại cho rõ ràng\nLàm cho các hướng dẫn rõ ràng hơn, giảm sự mơ hồ, và chỉ định các định dạng phản hồi mong đợi"
    },
    {
      "[y1, x1, y2, x2]": [705, 142, 752, 856],
      "text": "Thêm các ví dụ mẫu\nCung cấp các ví dụ tích cực và tiêu cực trong lời nhắc để neo giữ suy luận của tác tử"
    },
    {
      "[y1, x1, y2, x2]": [769, 142, 816, 856],
      "text": "Phân rã tác vụ\nChia nhỏ các hướng dẫn đa bước phức tạp thành các lời nhắc tuần tự nhỏ hơn hoặc các giai đoạn suy luận trung gian"
    },
    {
      "[y1, x1, y2, x2]": [923, 142, 935, 413],
      "text": "254 | Chương 11: Các vòng lặp cải tiến"
    }
  ],
  "page_17": [
    {
      "[y1, x1, y2, x2]": [88, 142, 135, 856],
      "text": "Mở rộng ngữ cảnh\nKết hợp thêm ngữ cảnh, các ràng buộc, hoặc thông tin nền liên quan để hướng dẫn tác tử hiệu quả hơn"
    },
    {
      "[y1, x1, y2, x2]": [152, 142, 269, 856],
      "text": "DSPy vượt trội trong việc tự động hóa việc tinh chỉnh lời nhắc bằng cách biên dịch các lời nhắc được tối ưu hóa từ một tập hợp các ví dụ. Đối với tác tử SOC, chúng ta có thể sử dụng DSPy để tinh chỉnh các lời nhắc nội bộ của một mô-đun ReAct, cải thiện cách tác tử xử lý các cảnh báo bằng cách điều chỉnh tốt hơn các lệnh gọi suy luận và công cụ với các phản hồi mong đợi. Điều này đặc biệt hữu ích để giải quyết các vấn đề như lựa chọn công cụ không tối ưu hoặc các đầu ra không nhất quán được xác định trong phản hồi. Đây là một đoạn mã DSPy ví dụ tối ưu hóa một mô-đun ReAct để xử lý sự cố SOC bằng cách sử dụng một tập hợp nhỏ các trường hợp kiểm thử tổng hợp (mở rộng lên 100+ ví dụ được chú thích trong thực tế để có kết quả tốt hơn):"
    },
    {
      "[y1, x1, y2, x2]": [286, 176, 903, 856],
      "code": "import dspy\ndspy.configure(lm=dspy.OpenAI(model=\"gpt-40-mini\"))\ndef lookup_threat_intel(indicator: str) -> str:\n\"\"\"Giả lập: Tra cứu thông tin tình báo về mối đe dọa cho một chỉ số.\"\"\"\nreturn f\"Thông tin tình báo giả lập cho {indicator}: có khả năng độc hại\"\ndef query_logs(query: str) -> str:\n\"\"\"Giả lập: Tìm kiếm và phân tích nhật ký bảo mật.\"\"\"\nreturn f\"Nhật ký giả lập cho '{query}': phát hiện hoạt động đáng ngờ\"\n# Một vài trường hợp kiểm thử tổng hợp (cảnh báo -> phản hồi mong đợi)\n# Trong thực tế, lấy từ nhật ký thực hoặc chú thích các lỗi;\n# nhắm đến 100+ để tối ưu hóa tốt hơn\ntrainset = [\ndspy.Example(alert='''Nỗ lực đăng nhập đáng ngờ từ IP 203.0.113.45 đến\ntài khoản quản trị.''',\nresponse ='''Tra cứu thông tin tình báo về IP, truy vấn nhật ký để tìm hoạt động,\nphân loại là dương tính thật, cô lập máy chủ nếu độc hại.''')\n.with_inputs('alert'),\ndspy.Example(alert=\"Tải xuống tệp bất thường từ URL example.com/malware.exe.\",\nresponse='''Tra cứu thông tin tình báo về URL và hash, truy vấn nhật ký\nđể tìm hoạt động điểm cuối, phân loại là dương tính thật, cô lập\nmáy chủ.''').with_inputs('alert'),\ndspy.Example(alert=\"Lưu lượng mạng cao đến tên miền suspicious-site.net.\",\nresponse='''Tra cứu thông tin tình báo về tên miền, truy vấn nhật ký\nmạng và tường lửa, phân loại là dương tính giả nếu\nlành tính.''').with_inputs('alert'),\ndspy.Example(alert='''Cảnh báo: Email lừa đảo tiềm năng với tệp đính kèm\nhash abc123.''',\nresponse='''Tra cứu thông tin tình báo về hash, truy vấn nhật ký email\nvà điểm cuối, phân loại là dương tính thật, gửi phản hồi cho phân tích viên.''').with_inputs('alert'),\ndspy.Example(alert='''Bất thường trong hành vi người dùng: nhiều lần đăng nhập thất bại từ\nthiết bị mới.''',\nresponse ='''Truy vấn nhật ký để xác thực, tra cứu thông tin tình báo\ncho IP thiết bị, phân loại là dương tính thật nếu mẫu khớp\nvới tấn công.''').with_inputs('alert'),"
    },
    {
      "[y1, x1, y2, x2]": [923, 684, 935, 856],
      "text": "Các đường ống phản hồi | 255"
    }
  ],
  "page_18": [
    {
      "[y1, x1, y2, x2]": [88, 176, 266, 856],
      "code": "]\n# Định nghĩa mô-đun ReAct để xử lý sự cố SOC\nreact = dspy.ReAct(\"cảnh báo -> phản hồi\", tools=[lookup_threat_intel, query_logs])\n# Bộ tối ưu hóa với một chỉ số đơn giản\n# (khớp chính xác để minh họa;\n# sử dụng một chỉ số tinh vi hơn như\n# tương đồng ngữ nghĩa trong môi trường sản xuất)\ntp = dspy.MIPROv2(metric=dspy.evaluate.answer_exact_match, auto=\"light\",\nnum_threads=24)\noptimized_react = tp.compile(react, trainset=trainset)"
    },
    {
      "[y1, x1, y2, x2]": [283, 142, 366, 856],
      "text": "Mã này tối ưu hóa các lời nhắc của mô-đun ReAct (ví dụ: cho các bước suy luận và gọi công cụ) để phù hợp hơn với các ví dụ được cung cấp, tinh chỉnh hiệu quả hành vi của tác tử mà không cần tinh chỉnh lời nhắc thủ công. optimized_react kết quả có thể được tích hợp vào luồng công việc của tác tử SOC, dẫn đến việc xử lý các cảnh báo đa dạng một cách đáng tin cậy hơn và giảm các vấn đề như ảo giác hoặc các đầu ra lạc đề."
    },
    {
      "[y1, x1, y2, x2]": [383, 142, 450, 856],
      "text": "Trong các hệ thống phản hồi nâng cao, các điều chỉnh lời nhắc thậm chí có thể được tự động hóa để phản ứng với các mẫu lỗi quan sát được, mặc dù tất cả các thay đổi nên được xác thực—tốt nhất là trong cả kiểm thử ngoại tuyến và triển khai ẩn trực tiếp—để ngăn chặn sự suy giảm hoặc các tác dụng phụ không mong muốn."
    },
    {
      "[y1, x1, y2, x2]": [467, 142, 487, 321],
      "text": "Tinh chỉnh công cụ"
    },
    {
      "[y1, x1, y2, x2]": [505, 142, 588, 856],
      "text": "Trong các kiến trúc tác tử hiện đại, chỉ riêng các lời nhắc hiếm khi đủ. Các tác tử ngày càng dựa vào một bộ công cụ bên ngoài—các API, các hàm mã, các truy vấn cơ sở dữ liệu, hoặc các kỹ năng tùy chỉnh để truy xuất thông tin, thực hiện các giao dịch, hoặc thực hiện các hành động cụ thể. Các đường ống phản hồi thường xuyên làm nổi bật các vấn đề như:"
    },
    {
      "[y1, x1, y2, x2]": [605, 159, 722, 856],
      "list": [
        "Lựa chọn công cụ không chính xác hoặc không tối ưu cho một tác vụ người dùng nhất định",
        "Sai lệch tham số hoặc các đầu vào bị sai định dạng cho các lệnh gọi công cụ",
        "Lỗ hổng trong bộ công cụ—các tác vụ mà tác tử không thể hoàn thành do thiếu hoặc không đầy đủ các công cụ",
        "Các lỗi trong chuỗi công cụ, nơi đầu ra của một bước không được định dạng đúng cho bước tiếp theo"
      ]
    },
    {
      "[y1, x1, y2, x2]": [739, 142, 752, 488],
      "text": "Tinh chỉnh công cụ là một quy trình đa cấp:"
    },
    {
      "[y1, x1, y2, x2]": [769, 142, 799, 856],
      "text": "Tinh chỉnh logic nội bộ\nTối ưu hóa các lời nhắc hoặc các mô hình trong các công cụ để xử lý và phân loại dữ liệu tốt hơn"
    },
    {
      "[y1, x1, y2, x2]": [816, 142, 863, 856],
      "text": "Mở rộng khả năng\nNâng cao các công cụ để bao quát các kịch bản rộng hơn bằng cách kết hợp suy luận được tối ưu hóa"
    },
    {
      "[y1, x1, y2, x2]": [923, 142, 935, 413],
      "text": "256 | Chương 11: Các vòng lặp cải tiến"
    }
  ],
  "page_19": [
    {
      "[y1, x1, y2, x2]": [88, 142, 118, 773],
      "text": "Các cải tiến tích hợp\nĐảm bảo các công cụ xuất ra các kết quả đáng tin cậy, có thể hành động cho các nhu cầu của tác tử"
    },
    {
      "[y1, x1, y2, x2]": [135, 142, 252, 856],
      "text": "DSPy hỗ trợ tinh chỉnh công cụ bằng cách tối ưu hóa cách các công cụ được lựa chọn và xâu chuỗi trong các mô-đun của tác tử. Mở rộng ví dụ trước, giả sử phản hồi cho thấy một lỗ hổng trong bộ công cụ để phân loại sự cố (ví dụ: tác tử thường bỏ qua các bước phân loại, dẫn đến các quyết định không tối ưu). Chúng ta có thể thêm một công cụ giả lập mới để phân loại, cập nhật mô-đun ReAct để bao gồm nó, mở rộng tập huấn luyện với các ví dụ nhấn mạnh việc xâu chuỗi công cụ đúng cách, và tối ưu hóa lại. Điều này cải thiện các phương pháp tìm kiếm heuristic để chọn công cụ và sự tích hợp, làm cho tác tử mạnh mẽ hơn trước sự biến đổi của thế giới thực. Đây là mã DSPy mở rộng:"
    },
    {
      "[y1, x1, y2, x2]": [269, 176, 903, 856],
      "code": "import dspy\ndspy.configure(lm=dspy.LM(\"openai/gpt-40-mini\"))\n# Định nghĩa một chữ ký DSPy cho tác vụ phân loại mối đe dọa\nclass ThreatClassifier (dspy. Signature):\n\"\"\"Phân loại mức độ đe dọa của một chỉ số nhất định (ví dụ: IP, URL, hash) là\n'lành tính', 'đáng ngờ', hoặc 'độc hại'.\"\"\"\nindicator: str = dspy. InputField(desc=\"Chỉ số cần phân loại, chẳng hạn như\nđịa chỉ IP, URL, hoặc hash tệp.\")\nthreat_level: str = dspy. OutputField(desc=\"Mức độ đe dọa được phân loại:\n'lành tính', 'đáng ngờ', hoặc 'độc hại'.\")\n# Một mô-đun DSPy sử dụng ChainOfThought để phân loại có suy luận\nclass ThreatClassificationModule(dspy.Module):\ndef __init__(self):\nsuper().__init__()\nself.classify = dspy. ChainOfThought(ThreatClassifier)\ndef forward(self, indicator):\nreturn self.classify(indicator=indicator)\n# Tập dữ liệu tổng hợp/chú thích thủ công để tối ưu hóa (trong thực tế, sử dụng 50-200+\n# ví dụ từ nhật ký SOC thực)\n# Mỗi ví dụ bao gồm một chỉ số và mức độ đe dọa thực tế\ntrainset = [\ndspy. Example(indicator=\"203.0.113.45\",\nthreat_level=\"đáng ngờ\").with_inputs('indicator'), # IP độc hại đã biết\ndspy.Example(indicator=\"example.com/malware.exe\",\nthreat_level=\"độc hại\").with_inputs('indicator'), # URL độc hại\ndspy.Example(indicator=\"benign-site.net\",\nthreat_level=\"lành tính\").with_inputs('indicator'), # Tên miền an toàn\ndspy. Example(indicator=\"abc123def456\",\nthreat_level=\"độc hại\").with_inputs('indicator'), # Hash phần mềm độc hại\ndspy.Example(indicator=\"192.168.1.1\",\nthreat_level=\"lành tính\").with_inputs('indicator'), # IP cục bộ\ndspy.Example(indicator=\"obfuscated.url/with?params\",\nthreat_level=\"đáng ngờ\").with_inputs ('indicator'),\n# Trường hợp biên: URL bị làm rối"
    },
    {
      "[y1, x1, y2, x2]": [923, 684, 935, 856],
      "text": "Các đường ống phản hồi | 257"
    }
  ],
  "page_20": [
    {
      "[y1, x1, y2, x2]": [88, 176, 385, 856],
      "code": "dspy.Example(indicator=\"new-attack-vector-hash789\",\nthreat_level=\"độc hại\").with_inputs('indicator'), # Mối đe dọa mới\n]\n# Chỉ số để đánh giá (khớp chính xác về mức độ đe dọa\n# sử dụng khớp ngữ nghĩa hoặc bộ chấm điểm tùy chỉnh cho môi trường sản xuất)\ndef threat_match_metric(example, pred, trace=None):\nreturn example.threat_level.lower() == pred.threat_level.lower()\n# Tối ưu hóa mô-đun (điều này tinh chỉnh các lời nhắc nội bộ để\n# xử lý tốt hơn các trường hợp đa dạng)\noptimizer = dspy.BootstrapFewshotWithRandomSearch(metric=threat_match_metric,\nmax_bootstrapped_demos=4, max_labeled_demos=4)\noptimized_module = optimizer.compile(ThreatClassificationModule(),\ntrainset=trainset)\n# Ví dụ sử dụng trong công cụ: Sau khi tối ưu hóa, sử dụng trong classify_threat\ndef classify_threat(indicator: str) -> str:\n\"\"\"Phân loại mức độ đe dọa bằng mô-đun DSPy được tối ưu hóa.\"\"\"\nprediction = optimized_module(indicator=indicator)\nreturn prediction.threat_level"
    },
    {
      "[y1, x1, y2, x2]": [402, 142, 485, 856],
      "text": "Sự tinh chỉnh này nâng cao khả năng của công cụ trong việc phân loại chính xác các mức độ đe dọa từ dữ liệu API thực, xử lý một loạt các phản hồi rộng hơn—bao gồm các trường hợp không có kết quả, các kết quả khớp một phần, hoặc các mối đe dọa mới nổi—bằng cách tối ưu hóa lời nhắc diễn giải của mô hình nền tảng."
    },
    {
      "[y1, x1, y2, x2]": [502, 142, 568, 856],
      "text": "Mỗi lần tinh chỉnh lời nhắc hoặc công cụ nên được tài liệu hóa với một lý do rõ ràng—vấn đề nào đã được quan sát, thay đổi nào đã được thực hiện, và hiệu quả của nó sẽ được đo lường như thế nào. Kỷ luật này đảm bảo các cải tiến có thể truy vết và lặp lại, và cung cấp cho các đội trong tương lai một cơ sở kiến thức về những gì hoạt động và tại sao."
    },
    {
      "[y1, x1, y2, x2]": [585, 142, 668, 856],
      "text": "Các cải tiến nên được xác thực một cách lặp đi lặp lại, sử dụng cả đánh giá ngoại tuyến (với các nhật ký được giữ lại hoặc các trường hợp tổng hợp) và các thử nghiệm trực tiếp có kiểm soát (ví dụ: triển khai ẩn, thử nghiệm A/B). Việc giám sát hiệu suất sau khi triển khai là rất quan trọng: ngay cả những tinh chỉnh lời nhắc có vẻ nhỏ cũng có thể có các ảnh hưởng trên toàn hệ thống, đặc biệt là trong các môi trường phức tạp hoặc có tính tác tử cao."
    },
    {
      "[y1, x1, y2, x2]": [685, 142, 768, 856],
      "text": "Theo thời gian, hiệu ứng tích lũy của việc đưa ra lời nhắc và tinh chỉnh công cụ một cách có hệ thống là rất đáng kể. Các tác tử trở nên đáng tin cậy hơn, ít giòn hơn, và phù hợp hơn với nhu cầu của người dùng. Việc tinh chỉnh dựa trên phản hồi cũng tiết lộ các mẫu ở cấp độ cao hơn—các nguồn gây hiểu lầm phổ biến hoặc các lỗ hổng lặp lại về năng lực—có thể cung cấp thông tin cho các cải tiến về kiến trúc và thiết kế tác tử trong tương lai."
    },
    {
      "[y1, x1, y2, x2]": [785, 142, 852, 856],
      "text": "Việc tinh chỉnh lời nhắc và công cụ là các công cụ thực hành của sự tiến bộ trong các hệ thống tác tử. Bằng cách kết nối thông tin chuyên sâu với hành động, và lặp lại một cách cẩn trọng, các đội có thể đảm bảo rằng mọi thất bại hoặc điểm gây khó khăn đều trở thành cơ hội cho một AI mạnh mẽ, đáp ứng nhanh và có năng lực hơn."
    },
    {
      "[y1, x1, y2, x2]": [923, 142, 935, 413],
      "text": "258 | Chương 11: Các vòng lặp cải tiến"
    }
  ]
}