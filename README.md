# Swift POS - Point of Sale System

A modern, feature-rich Point of Sale (POS) system built with React, TypeScript, and Tailwind CSS. Designed for retail businesses to manage inventory, process sales, and generate comprehensive reports.

## 🚀 Features

### Core POS Features
- **Point of Sale Interface**: Fast and intuitive checkout system with cart management
- **Product Management**: Full CRUD operations for products with variants support
- **Category Management**: Organize products by categories
  - Create, edit, and delete categories
  - Search functionality for quick category lookup
  - Categories help organize products for easier management
- **User Management** (Admin Only):
  - Create, update, and delete system users
  - Assign admin or cashier roles
  - Secure password management with bcrypt hashing
  - Search users by name or email
- **Sales Tracking**: Complete sales history with detailed transaction records
- **Role-Based Access Control**: Admin and Cashier roles with different permission levels
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices

### Advanced Inventory Management

#### **Monthly Sold Tracking**
- Automatically tracks how many units of each product were sold per month
- Visible in the inventory table for quick reference
- Used for fast/slow moving item analysis

#### **Fast Moving & Slow Moving Filters**
- **Fast Moving**: Products with sales above the median (top 50% of items with sales)
- **Slow Moving**: Products with sales at or below the median (including zero sales)
- Helps identify bestsellers and items that need promotion
- Sortable by monthly sold count

#### **Low Stock Management**
- **Per-Variant Stock Tracking**: Each variant (e.g., Small, Large) is tracked individually
- **Low Stock Alerts**: Visual indicators (red badges) when stock falls below threshold
- **Restock Badge**: Shows "Restock" badge when stock reaches zero
- **Disabled Status**: Items with zero stock automatically show "Disabled" status
- **POS Visibility**: Items/variants with zero stock are automatically hidden from POS

#### **Restock Functionality**
- **Variant-Level Restocking**: Restock individual variants separately
- **Bulk Restock Dialog**: Restock multiple products/variants at once
- **Low Stock Priority**: Low stock items appear first in the restock dialog
- **Visual Indicators**: Red alert icons highlight items needing restock

#### **OCR Menu Scanning**
- **Scan Menu Feature**: Upload or capture menu images to extract product names and prices
- **Automatic Extraction**: Uses OCR technology to parse menu items
- **Batch Import**: Import multiple products at once from scanned menus
- **Bulk Settings**: Apply category, margin, default stock, and low stock threshold to all items
- **Edit Before Import**: Review and edit extracted items before importing

### POS Enhancements

#### **Image Search**
- **Visual Product Search**: Search for products by taking a photo
- **Similarity Matching**: Uses perceptual hashing to find visually similar products
- **Camera Integration**: Automatic camera access for quick product lookup
- **Settings Toggle**: Enable/disable image search in Settings page

#### **Barcode/QR Code Scanning**
- **Multiple Scanner Support**: 
  - Physical barcode scanners (keyboard emulation)
  - Camera-based barcode/QR code detection
- **Automatic Product Detection**: Scans item codes, barcodes, SKUs, and QR codes
- **Priority System**: Barcode scanning takes priority over image search when both are enabled
- **Settings Integration**: Toggle barcode scanning in Settings page

#### **Discount Management**
- **Percentage-Based Discounts**: Apply discounts as a percentage (0-100%)
- **Configurable Feature**: Enable/disable discounts in Settings (Admin only)
- **Discount Calculation**: Applied to subtotal before tax calculation
- **Cart Display**: Shows discount amount and percentage in cart summary
- **Receipt Integration**: Discounts appear on printed receipts

#### **Receipt Printing**
- **Bluetooth Thermal Printers**: Native Android support for Bluetooth thermal printers
- **Browser Printing**: Fallback to browser print dialog for web/desktop
- **Auto-Print Option**: Configurable automatic receipt printing after sale
- **Receipt Customization**:
  - Store name and address header
  - Optional logo display
  - Ticket number generation
  - Cashier name display
  - Itemized product list with variants
  - Subtotal, tax, discount, and total breakdown
  - Amount received and change
  - Custom footer message
- **Test Print Function**: Test printer connection and configuration
- **Printer Management**: Scan for paired Bluetooth printers, select active printer

### Reports & Analytics (Admin Only)

#### **Sales Overview**
- **Bar Chart**: Visual representation of daily sales (dark green bars)
- **Transaction Count**: Line chart showing number of transactions per day
- **Average Order Value (AOV)**: Trend chart tracking average transaction value
- **Date Range Selection**: Weekly, Monthly, Annual, or custom date ranges

#### **Product Analytics**
- **Top Products**: Pie chart showing top 5 highest revenue-generating products
- **Peak Hours**: Pie chart displaying top 5 busiest transaction hours
- **Payment Methods**: Breakdown of sales by payment type

#### **Inventory Insights**
- **Low Stock Alerts**: Table listing products/variants below stock threshold
- **Highest Margin Products**: Table showing top 5 most profitable items
- **Per-Variant Analysis**: Low stock alerts work at variant level

#### **Export Functionality**
- **Reports Export**: Export all report data to multi-sheet Excel workbook
  - Sheets Included: Sales, Products, and Low Stock data
  - Date Stamped: Files include date in filename
- **Sales History Export**: Export sales data with multiple date range options
  - **Export Ranges**: Today, This Week, This Month, This Quarter, This Year
  - **Profit Analysis**: Includes profit calculations and margin percentages
  - **Inventory Data**: Approximate opening stock, closing stock, and quantity sold
  - **Grand Totals**: Automatic calculation of total sales and profit

### User Interface Features

#### **Responsive Layout**
- **Desktop**: Persistent sidebar navigation, full table views
- **Tablet Landscape**: Sidebar navigation, optimized layouts
- **Tablet Portrait**: Burger menu, mobile-style cart (bottom sheet)
- **Mobile**: Compact views, floating cart button, bottom sheet cart

#### **Visual Indicators**
- **Low Stock Badges**: Red "Low Stock" badge for items below threshold
- **Restock Badges**: Red "Restock" badge for zero stock items
- **Status Badges**: Color-coded status indicators (Active/Disabled)
- **Warning Icons**: Red alert triangles for low/zero stock items

## 📋 How to Use

### Setting Up Products

1. **Add Product**:
   - Click "Add Product" button
   - Enter product details (name, category, price, stock)
   - Set low stock threshold
   - Optionally add variants (sizes, colors, etc.)

2. **Scan Menu (OCR)**:
   - Click "Scan Menu" button
   - Upload menu image or capture with camera
   - Review extracted items
   - Set bulk settings (category, margin, stock)
   - Click "Import" to add all items

3. **Manage Variants**:
   - Click "Variants" button on a product
   - Add/edit variant names, prices, and stock levels
   - Each variant is tracked independently

### Managing Inventory

1. **View Filters**:
   - **All**: Show all products
   - **Low Stock**: Products/variants below threshold
   - **Fast Moving**: Top-selling items
   - **Slow Moving**: Items with low or no sales

2. **Restock Items**:
   - Click "Restock" button
   - Find product/variant in the list
   - Enter quantity to add
   - Click "Add" or press Enter
   - Variants are listed individually for precise restocking

3. **Low Stock Alerts**:
   - Items with low stock show red name and warning icon
   - "Low Stock" badge appears in status column
   - Zero stock items show "Restock" badge and "Disabled" status

### Processing Sales (POS)

1. **Search Products**:
   - Use search bar to find products by name
   - Use image search (camera icon) to find products visually
   - Scan barcode/QR code with physical scanner or camera

2. **Add to Cart**:
   - Click product card to add to cart
   - For products with variants, select variant from modal
   - Cart shows items, quantities, and totals

3. **Apply Discounts** (if enabled):
   - Enter discount percentage in cart (0-100%)
   - Discount is applied to subtotal before tax
   - Discount amount is displayed in cart summary

4. **Checkout**:
   - Click cart icon (mobile) or review cart (desktop)
   - Enter amount received
   - Click "Complete Sale"
   - Receipt can be printed automatically (if auto-print enabled)
   - Receipt includes all transaction details: items, discounts, tax, totals

### Viewing Reports (Admin Only)

1. **Access Reports**:
   - Navigate to "Reports" from sidebar (admin only)
   - Select date range (Weekly/Monthly/Annual or custom)

2. **View Analytics**:
   - **Sales Overview**: Bar chart of daily sales
   - **Transaction Count**: Line chart of daily transactions
   - **AOV Trend**: Average order value over time
   - **Top Products**: Top 5 products by revenue
   - **Peak Hours**: Busiest transaction times
   - **Payment Methods**: Sales breakdown by payment type

3. **Export Data**:
   - **Reports Export**: Click "Export" button to download Excel file with all report data
     - Multiple sheets included (Sales, Products, Low Stock)
   - **Sales History Export**: Use export dropdown in Sales page
     - Select date range (Today, This Week, This Month, This Quarter, This Year)
     - Excel file includes detailed sales data with profit analysis

### Backup & Restore

#### **Server-Side Backup** (Web/Desktop)
- **Automatic Backups**: Daily backups created automatically at midnight
- **Manual Backups**: Create backups on-demand from Settings page
- **Backup Management**: View all available backups with date, time, and file size
- **Restore Functionality**: Restore database from any previous backup
- **Safety Features**: Automatically creates backup before restoring (pre-restore backup)
- **Backup Cleanup**: Old backups automatically removed (configurable retention period)

#### **Mobile Backup** (Android/iOS)
- **Manual Backup Creation**: Create database backups on-demand
- **Backup Export**: Export backup files using device share functionality
- **Backup List**: View all available mobile backups
- **Restore from Backup**: Restore database from selected backup file
- **Safety Features**: Pre-restore backup created automatically before restoring

### Settings Configuration

1. **POS Features**:
   - **Enable Image Search**: Toggle visual product search
   - **Enable Barcode Scanning**: Toggle barcode/QR code detection
   - **Enable Discounts**: Toggle discount functionality in POS

2. **Store Information**:
   - Set store name and address (used on receipts)
   - Configure tax rate (percentage, defaults to 12%)
   - Enable/disable discounts feature

3. **Receipt Settings**:
   - **Auto-Print Receipt**: Automatically print receipt after each sale
   - **Show Logo on Receipt**: Include business logo on printed receipts
   - **Tax Rate**: Configure tax percentage applied to transactions

4. **Bluetooth Printer** (Mobile Only):
   - **Scan for Printers**: Discover paired Bluetooth thermal printers
   - **Select Printer**: Choose active printer for receipt printing
   - **Test Print**: Send test receipt to verify printer connection
   - **Printer Status**: View connected printer name and address

## 🛠️ Technology Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **UI Components**: shadcn-ui
- **Charts**: Recharts
- **Date Handling**: date-fns
- **OCR**: Tesseract.js
- **Export**: xlsx (Excel)
- **Database**: SQLite (Prisma ORM)
- **Mobile**: Capacitor
- **Printer**: ESC/POS encoder for thermal printers
- **Authentication**: bcryptjs for password hashing
- **State Management**: React Context API, TanStack Query
- **Backend**: Express.js (Node.js)
- **Image Processing**: Perceptual hashing for image similarity search

## 📦 Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project directory
cd swift_pos

# Install dependencies
npm install

# Set up database
npx prisma migrate dev

# Seed sample data (optional)
npx prisma db seed

# Start development server (frontend)
npm run dev

# Start backend server (in separate terminal)
npm run dev:server

# Generate Prisma client
npm run prisma:generate
```

## 🔐 Default Credentials

- **Admin**: 
  - Email: `john@example.com`
  - Password: `password123`
- **Cashier**: 
  - Email: `cashier@example.com`
  - Password: `password123`

> **Note**: These credentials are stored in both server and mobile databases. Make sure to change default passwords in production environments.

## 📱 Mobile App

The system is built with Capacitor and can be deployed as a mobile app:

```sh
# Build web assets
npm run build

# Add platform
npx cap add android
# or
npx cap add ios

# Sync and open
npx cap sync
npx cap open android
```

## 🎯 Key Workflows

### Daily Operations
1. **Opening**: Check low stock alerts, restock as needed
2. **Sales**: Process transactions using POS interface
3. **Closing**: Review daily sales report, export if needed

### Weekly Tasks
1. Review fast/slow moving items
2. Adjust inventory based on sales trends
3. Generate weekly sales report

### Monthly Tasks
1. Analyze top products and peak hours
2. Review profit margins
3. Export comprehensive reports

## 🔄 Stock Management Rules

- **Zero Stock Visibility**: Items/variants with 0 stock are hidden from POS
- **Low Stock Threshold**: Set per product, alerts when stock falls below
- **Variant Independence**: Each variant tracked separately
- **Automatic Status**: Zero stock = "Disabled" status automatically

## 📊 Report Features

- **Real-time Data**: All reports reflect current sales data
- **Date Filtering**: Flexible date range selection
- **Visual Charts**: Multiple chart types for different insights
- **Export Ready**: Excel export for further analysis
- **Admin Only**: Reports page restricted to admin users

## 🐛 Troubleshooting

### Chart Not Showing
- Ensure sales data exists for selected date range
- Check browser console for errors
- Verify data structure matches expected format

### OCR Not Working
- Ensure image is clear and well-lit
- Try different image formats (PNG, JPG)
- Check browser permissions for camera access

### Barcode Scanner Not Detecting
- Verify barcode scanner is in keyboard emulation mode
- Check Settings page for barcode scanning toggle
- Ensure product has item code/barcode set

### Printer Not Working (Mobile)
- Ensure printer is paired in Android/iOS Bluetooth settings
- Check that Bluetooth is enabled on device
- Verify printer is powered on and in range
- Try scanning for printers again in Settings
- Use Test Print function to verify connection

### Backup/Restore Issues
- **Server**: Ensure server is running (`npm run dev:server`)
- **Mobile**: Check that you have sufficient storage space
- **Restore**: Always creates a backup before restoring (safety feature)
- **Export**: Mobile backups can be exported using device share functionality

## 📝 Notes

- **Stock Management**: All stock calculations are variant-aware. Low stock checks happen at variant level, not product level
- **Access Control**: Reports, Settings, Users, Categories, and Inventory pages require admin role
- **Discounts**: Must be enabled in Settings before they appear in POS cart. Applied to subtotal before tax
- **Receipts**: Can be printed via Bluetooth (mobile) or browser print dialog (web/desktop)
- **Backups**: Server backups run automatically daily at midnight. Mobile backups must be created manually
- **Database**: System uses SQLite with Prisma ORM. Separate databases for server (web) and mobile (native app)
- **Mobile**: Full offline functionality with local SQLite database. Sync with server when available
- **Tax Calculation**: Tax is applied after discounts. Formula: `(subtotal - discount) × (1 + taxRate)`

## 🤝 Contributing

This is a private project. For issues or feature requests, please contact the project maintainer.

## 📄 License

Private - All rights reserved
