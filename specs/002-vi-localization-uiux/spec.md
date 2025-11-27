# Feature Specification: Vietnamese Localization & UI/UX Optimization

**Feature Branch**: `002-vi-localization-uiux`  
**Created**: 2025-01-27  
**Status**: Draft  
**Input**: User description: "dịch toàn bộ text tiếng Anh thành tiếng Việt vì đây là app cho người Việt. Điều chỉnh UIUX của app theo hướng dẫn:"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Vietnamese Language Interface (Priority: P1)

Người dùng Việt Nam mở ứng dụng và thấy toàn bộ giao diện hiển thị bằng tiếng Việt, từ các nút bấm, thông báo, nhãn form, đến các thông điệp lỗi và thành công. Người dùng có thể hiểu và sử dụng ứng dụng mà không cần biết tiếng Anh.

**Why this priority**: Đây là ứng dụng dành cho người Việt, đặc biệt là người lớn tuổi trong tình huống khẩn cấp. Việc hiển thị tiếng Việt là yêu cầu cơ bản để người dùng có thể sử dụng ứng dụng hiệu quả.

**Independent Test**: Có thể kiểm tra độc lập bằng cách mở ứng dụng và xác minh tất cả văn bản hiển thị đều bằng tiếng Việt, không còn text tiếng Anh nào trong giao diện người dùng.

**Acceptance Scenarios**:

1. **Given** người dùng mở màn hình Home, **When** xem giao diện, **Then** tất cả tiêu đề, mô tả, nút bấm đều hiển thị bằng tiếng Việt
2. **Given** người dùng mở form tạo nhóm, **When** xem các trường input và label, **Then** tất cả label, placeholder, thông báo lỗi đều bằng tiếng Việt
3. **Given** người dùng gửi tin nhắn SOS, **When** chọn loại SOS, **Then** tất cả các tùy chọn và mô tả hiển thị bằng tiếng Việt
4. **Given** người dùng cập nhật trạng thái an toàn, **When** xem các tùy chọn trạng thái, **Then** tất cả label và mô tả đều bằng tiếng Việt
5. **Given** hệ thống hiển thị thông báo (toast, alert), **When** thông báo xuất hiện, **Then** nội dung thông báo bằng tiếng Việt

---

### User Story 2 - High Contrast Color System for Emergency Situations (Priority: P1)

Người dùng trong tình huống khẩn cấp có thể nhận diện ngay lập tức các chức năng quan trọng thông qua hệ thống màu sắc ngữ nghĩa với độ tương phản cao. Màu đỏ/cam cho SOS, xanh lá cho an toàn, vàng/cam cho cảnh báo được áp dụng nhất quán trong toàn bộ ứng dụng.

**Why this priority**: Trong tình huống hoảng loạn, người dùng không thể đọc nhiều. Màu sắc phải truyền đạt thông tin ngay lập tức. Độ tương phản cao đảm bảo người lớn tuổi và người có thị lực kém vẫn có thể sử dụng.

**Independent Test**: Có thể kiểm tra độc lập bằng cách xem xét tất cả các component và xác minh màu sắc tuân theo hệ thống màu ngữ nghĩa, đặc biệt là nút SOS phải nổi bật nhất với màu đỏ/cam.

**Acceptance Scenarios**:

1. **Given** người dùng xem màn hình Home, **When** nhìn vào nút SOS, **Then** nút có màu đỏ/cam rực rỡ với độ tương phản cao nhất so với nền trắng
2. **Given** người dùng xem trạng thái an toàn, **When** trạng thái là "Tôi an toàn", **Then** hiển thị màu xanh lá đậm (không phải xanh nõn chuối)
3. **Given** người dùng xem trạng thái mạng, **When** mạng yếu hoặc đang đồng bộ, **Then** hiển thị màu vàng nghệ hoặc cam đất
4. **Given** người dùng xem các nút điều hướng thông thường, **When** xem các nút bấm, **Then** sử dụng màu xanh dương hoặc tím than (Primary)
5. **Given** người dùng xem thông báo trạng thái mạng, **When** mất kết nối, **Then** hiển thị banner màu xám (Muted) ngay dưới header

---

### User Story 3 - Large Touch Targets and Thumb-Friendly Layout (Priority: P1)

Người dùng có thể dễ dàng bấm vào các nút quan trọng (SOS, Gửi tin, Cập nhật trạng thái) bằng một tay, ngón cái, ngay cả khi tay run hoặc màn hình bị ướt. Các nút quan trọng nằm ở nửa dưới màn hình trong vùng với tay tự nhiên.

**Why this priority**: Trong tình huống khẩn cấp, người dùng có thể đang di chuyển, tay run, hoặc màn hình bị ướt. Các thao tác quan trọng phải dễ thực hiện ngay cả trong điều kiện không lý tưởng.

**Independent Test**: Có thể kiểm tra độc lập bằng cách đo kích thước các nút bấm và vị trí của chúng, xác minh tất cả nút có chiều cao tối thiểu 48px và các nút quan trọng nằm ở nửa dưới màn hình.

**Acceptance Scenarios**:

1. **Given** người dùng xem nút SOS, **When** đo kích thước nút, **Then** nút có chiều cao tối thiểu 48px (hoặc lớn hơn)
2. **Given** người dùng xem nút "Gửi tin nhắn", **When** xem vị trí nút, **Then** nút nằm ở nửa dưới màn hình trong vùng với tay tự nhiên
3. **Given** người dùng xem các nút trong form, **When** đo khoảng cách giữa các nút, **Then** khoảng cách tối thiểu 8-12px để tránh bấm nhầm
4. **Given** người dùng xem các thẻ nhóm (Group Card), **When** đo kích thước thẻ, **Then** thẻ có chiều cao tối thiểu 48px để dễ bấm

---

### User Story 4 - Large, Readable Typography (Priority: P2)

Người dùng lớn tuổi hoặc có thị lực kém có thể đọc được tất cả văn bản trong ứng dụng mà không cần kính, với cỡ chữ tối thiểu 16pt cho văn bản chính và tiêu đề lớn hơn, đậm hơn để phân cấp rõ ràng.

**Why this priority**: Ứng dụng phục vụ người dùng ở mọi độ tuổi, bao gồm người lớn tuổi. Cỡ chữ nhỏ sẽ khiến ứng dụng không thể sử dụng được trong tình huống khẩn cấp.

**Independent Test**: Có thể kiểm tra độc lập bằng cách đo cỡ chữ của tất cả văn bản trong ứng dụng và xác minh văn bản chính đạt tối thiểu 16pt, tiêu đề đạt 20pt+.

**Acceptance Scenarios**:

1. **Given** người dùng xem văn bản chính (body text), **When** đo cỡ chữ, **Then** cỡ chữ tối thiểu 16pt
2. **Given** người dùng xem tiêu đề màn hình hoặc tiêu đề section, **When** đo cỡ chữ, **Then** cỡ chữ đạt 20pt+ và đậm (bold)
3. **Given** người dùng xem label hoặc caption, **When** đo cỡ chữ, **Then** cỡ chữ không nhỏ hơn 13px
4. **Given** người dùng xem tên nhóm trong thẻ, **When** xem typography, **Then** tên nhóm lớn nhất và đậm để phân cấp rõ ràng

---

### User Story 5 - Visual Feedback and Loading States (Priority: P2)

Người dùng luôn biết trạng thái của ứng dụng thông qua các tín hiệu thị giác rõ ràng. Khi tải dữ liệu, hiển thị skeleton thay vì spinner. Khi mất mạng, giao diện chuyển sang tông màu xám nhẹ nhưng vẫn cho phép đọc nội dung cũ.

**Why this priority**: Trong tình huống khẩn cấp, người dùng cần biết ứng dụng vẫn hoạt động. Skeleton giúp người dùng cảm thấy ứng dụng đang tải cấu trúc nội dung, giảm cảm giác chờ đợi.

**Independent Test**: Có thể kiểm tra độc lập bằng cách xem các trạng thái loading và offline, xác minh skeleton được sử dụng thay vì spinner và trạng thái offline được hiển thị rõ ràng.

**Acceptance Scenarios**:

1. **Given** người dùng tải danh sách nhóm, **When** dữ liệu đang tải, **Then** hiển thị skeleton khớp với layout của GroupCard thay vì spinner
2. **Given** người dùng mất kết nối mạng, **When** xem giao diện, **Then** giao diện chuyển sang tông màu xám nhẹ hoặc có lớp phủ mờ ở các tính năng không khả dụng
3. **Given** người dùng mất kết nối, **When** xem tin nhắn cũ, **Then** vẫn có thể đọc nội dung cũ rõ ràng
4. **Given** người dùng gửi tin nhắn, **When** tin nhắn đang gửi, **Then** hiển thị trạng thái loading rõ ràng với feedback thị giác

---

### Edge Cases

- What happens when text tiếng Việt quá dài so với không gian hiển thị? (Ví dụ: "Cần hỗ trợ khẩn cấp" có thể dài hơn "Need Help")
- How does system handle việc hiển thị số (ví dụ: khoảng cách, số người online) kết hợp với text tiếng Việt?
- What happens when người dùng thay đổi cài đặt font size của hệ thống? Ứng dụng có tôn trọng cài đặt này không?
- How does system handle việc hiển thị thông báo lỗi từ API (có thể vẫn bằng tiếng Anh) kết hợp với giao diện tiếng Việt?
- What happens when một số từ tiếng Việt không có từ tương đương ngắn gọn? (Ví dụ: "Neighborhood" có thể dịch thành "Khu dân cư" - dài hơn)

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST hiển thị tất cả văn bản trong giao diện người dùng bằng tiếng Việt, bao gồm nhưng không giới hạn: nút bấm, label, placeholder, thông báo lỗi, thông báo thành công, tiêu đề, mô tả
- **FR-002**: System MUST dịch tất cả các loại SOS message (Medical, Flood, Fire, Missing Person) sang tiếng Việt với mô tả phù hợp
- **FR-003**: System MUST dịch tất cả các trạng thái an toàn (Safe, Need Help, Cannot Contact) sang tiếng Việt
- **FR-004**: System MUST dịch tất cả các loại nhóm (Neighborhood, Ward, District, Apartment, Other) sang tiếng Việt
- **FR-005**: System MUST áp dụng hệ thống màu ngữ nghĩa: màu đỏ/cam (#EF4444 hoặc tương đương) chỉ dùng cho SOS và tình huống nguy cấp
- **FR-006**: System MUST áp dụng màu xanh lá đậm (#16A34A hoặc tương đương) cho trạng thái an toàn và thông báo thành công
- **FR-007**: System MUST áp dụng màu vàng nghệ/cam đất (#EA580C hoặc tương đương) cho cảnh báo và trạng thái cần hỗ trợ không khẩn cấp
- **FR-008**: System MUST áp dụng màu xanh dương/tím than (#2563EB hoặc tương đương) cho các hành động điều hướng bình thường
- **FR-009**: System MUST đảm bảo tất cả nút bấm có chiều cao tối thiểu 48px
- **FR-010**: System MUST đảm bảo khoảng cách giữa các nút bấm liền kề tối thiểu 8-12px
- **FR-011**: System MUST đặt các nút quan trọng (SOS, Gửi tin, Cập nhật trạng thái) ở nửa dưới màn hình trong vùng với tay tự nhiên
- **FR-012**: System MUST sử dụng cỡ chữ tối thiểu 16pt cho văn bản chính (body text)
- **FR-013**: System MUST sử dụng cỡ chữ 20pt+ và đậm (bold) cho tiêu đề
- **FR-014**: System MUST không sử dụng cỡ chữ nhỏ hơn 13px cho bất kỳ văn bản nào
- **FR-015**: System MUST sử dụng font Sans-serif hiện đại (Inter, Roboto hoặc tương đương) với khoảng cách ký tự thoáng
- **FR-016**: System MUST hạn chế sử dụng font quá mảnh (Thin/Light), ưu tiên Regular và Bold
- **FR-017**: System MUST hiển thị thanh trạng thái mạng dưới dạng banner ngang ngay dưới header, không dùng icon nhỏ ở góc
- **FR-018**: System MUST sử dụng skeleton loading thay vì spinner cho các trạng thái tải dữ liệu
- **FR-019**: System MUST hiển thị trạng thái offline với tông màu xám nhẹ hoặc lớp phủ mờ nhưng vẫn cho phép đọc nội dung cũ rõ ràng
- **FR-020**: System MUST đảm bảo nút SOS là phần tử nổi bật nhất trong giao diện với hình dáng tròn hoặc bo góc rất lớn
- **FR-021**: System MUST thêm hiệu ứng lan tỏa (pulse) hoặc đổ bóng sâu cho nút SOS để gợi ý việc bấm vào
- **FR-022**: System MUST sử dụng thiết kế dạng Container (khối hộp) có bo góc cho các thẻ thông tin (Cards)
- **FR-023**: System MUST phân cấp thông tin trong thẻ: Badge (loại nhóm) nhận diện đầu tiên, tên nhóm lớn nhất, trạng thái (khoảng cách, số người) ở dưới
- **FR-024**: System MUST ưu tiên sử dụng Radio Button to hoặc Chips (thẻ chọn nhanh) cho các trạng thái thay vì input nhập liệu
- **FR-025**: System MUST hiển thị Toast/Sonner ở vị trí trên cùng (Top Center) thay vì góc dưới
- **FR-026**: System MUST hiển thị Toast trong 5-7 giây (lâu hơn mặc định) để người lớn tuổi kịp đọc
- **FR-027**: System MUST đảm bảo độ tương phản màu đạt chuẩn WCAG AAA cho tất cả văn bản quan trọng trên nền trắng
- **FR-028**: System MUST sử dụng màu xám nhạt (#F8FAFC hoặc tương đương) cho nền thẻ (Surface/Card) để tách biệt khỏi nền trắng mà không cần nhiều đường viền
- **FR-029**: System MUST sử dụng màu đen đậm (#0F172A hoặc tương đương) cho văn bản chính để đảm bảo độ dễ đọc tối đa
- **FR-030**: System MUST tùy biến component Badge để bo tròn (rounded-full) thay vì vuông góc và map màu theo semantic colors

### Key Entities _(include if feature involves data)_

- **Translated Text**: Văn bản đã được dịch từ tiếng Anh sang tiếng Việt, được lưu trữ trong code hoặc file cấu hình, bao gồm label, placeholder, thông báo, mô tả
- **Color Tokens**: Các biến màu ngữ nghĩa (SOS/Destructive, Safety/Success, Warning, Info/Primary, Muted) được định nghĩa trong hệ thống design tokens
- **Typography Scale**: Các cỡ chữ và trọng lượng font được định nghĩa (Heading 1, Heading 2, Body, Label/Caption)
- **Component Variants**: Các biến thể của component (Button variants, Badge variants) được tùy biến theo yêu cầu UI/UX

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% văn bản hiển thị trong giao diện người dùng được dịch sang tiếng Việt, không còn text tiếng Anh nào trong UI
- **SC-002**: Tất cả nút bấm quan trọng (SOS, Gửi tin, Cập nhật trạng thái) có chiều cao tối thiểu 48px và nằm ở nửa dưới màn hình
- **SC-003**: Tất cả văn bản chính đạt cỡ chữ tối thiểu 16pt, tiêu đề đạt 20pt+ và đậm
- **SC-004**: Nút SOS có độ tương phản màu đạt chuẩn WCAG AAA so với nền trắng và là phần tử nổi bật nhất trong giao diện
- **SC-005**: Hệ thống màu ngữ nghĩa được áp dụng nhất quán: 100% nút SOS sử dụng màu đỏ/cam, 100% trạng thái an toàn sử dụng màu xanh lá đậm
- **SC-006**: Thanh trạng thái mạng hiển thị dưới dạng banner ngang ngay dưới header trong 100% các màn hình có hiển thị trạng thái mạng
- **SC-007**: 100% trạng thái loading sử dụng skeleton thay vì spinner
- **SC-008**: Người dùng có thể đọc được tất cả văn bản trong ứng dụng mà không cần kính, được xác minh qua test với người dùng lớn tuổi (60+ tuổi)
- **SC-009**: Người dùng có thể bấm vào các nút quan trọng bằng một tay, ngón cái, trong điều kiện tay run hoặc màn hình ướt, với tỷ lệ thành công tối thiểu 95%
- **SC-010**: Toast/Sonner hiển thị ở vị trí Top Center và trong 5-7 giây cho tất cả các thông báo

## Assumptions

- Người dùng mục tiêu là người Việt Nam, không yêu cầu hỗ trợ đa ngôn ngữ hoặc chuyển đổi ngôn ngữ
- Tất cả văn bản từ API/backend sẽ được dịch sang tiếng Việt hoặc ứng dụng sẽ xử lý việc dịch ở frontend
- Thiết bị sử dụng có màn hình tối thiểu 320px width (mobile-first)
- Người dùng có thể cấu hình font size của hệ thống, nhưng ứng dụng vẫn đảm bảo cỡ chữ tối thiểu 16pt
- Hệ thống design tokens (Shadcn/UI) có thể được tùy biến để áp dụng hệ thống màu ngữ nghĩa
- Component library (Shadcn/UI) cho phép tùy biến kích thước, màu sắc, và typography

## Dependencies

- Component library Shadcn/UI đã được cài đặt và có thể tùy biến
- Design system/tokens có thể được cấu hình để áp dụng hệ thống màu ngữ nghĩa
- Tất cả các component hiện tại đã được implement và cần được cập nhật với text tiếng Việt và styling mới

## Out of Scope

- Hỗ trợ đa ngôn ngữ hoặc chuyển đổi ngôn ngữ động
- Thay đổi cấu trúc dữ liệu hoặc API
- Thay đổi logic nghiệp vụ của ứng dụng
- Tối ưu hiệu năng render (đã được đề cập trong guidelines nhưng không phải focus chính)
- Accessibility features ngoài những gì đã được đề cập (WCAG AAA cho màu sắc và typography)
