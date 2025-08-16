# Health Management App

A comprehensive health and wellness management application built with modern web technologies, featuring AI-powered health analysis, daily tracking, and case management.

## 🌟 Features

### Core Functionality
- **Daily Health Tracking**: Record daily diet, exercise, and health observations
- **AI Health Assistant**: Powered by DeepSeek AI for personalized health advice and analysis
- **Case Management**: Organize and track health cases and medical records
- **User Authentication**: Secure login and registration system
- **Responsive Design**: Mobile-first design with bottom navigation

### AI-Powered Features
- **Smart Health Analysis**: AI automatically analyzes diet and health records
- **Structured Data Extraction**: Converts natural language health records into structured JSON data
- **Personalized Recommendations**: Context-aware health advice based on time and user data
- **Natural Language Processing**: Chat interface for health-related queries

## 🏗️ Architecture

### Frontend
- **HTML5**: Semantic markup with accessibility features
- **CSS3**: Modern styling with Material Design principles
- **JavaScript**: ES6+ with modular architecture
- **Responsive Design**: Mobile-first approach with touch-friendly interface

### Backend
- **Flask**: Python web framework for API endpoints
- **MySQL**: Database for user management and health records
- **RESTful API**: Clean API design with proper error handling
- **CORS Support**: Cross-origin resource sharing enabled

### AI Integration
- **DeepSeek API**: Advanced language model for health analysis
- **Structured Output**: JSON-based data extraction from natural language
- **Context Awareness**: Time-based greetings and personalized responses

## 📱 User Interface

### Navigation Structure
- **Daily Tab**: Main health tracking interface
- **Case Tab**: Medical case management
- **Add Button**: Quick record creation (center positioned)
- **Square Tab**: Community and sharing features
- **Profile Tab**: User settings and personal information

### Key Components
- **Bottom Navigation**: Material Design-inspired tab navigation
- **Modal System**: Overlay-based content presentation
- **Date Picker**: Flatpickr integration for date selection
- **Loading States**: Smooth transitions and feedback indicators

## 🚀 Getting Started

### Prerequisites
- Python 3.7+
- MySQL 5.7+
- Node.js (for development tools)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/JunxiBao/health
   cd health
   ```

2. **Set up environment variables**
   ```bash
   # Create .env file in src/backend/routes and complete these data.
   DB_HOST
   DB_USER
   DB_PASSWORD
   DB_NAME
   DEEPSEEK_API_KEY

   ALIYUN_ACCESS_KEY_ID
   ALIYUN_ACCESS_KEY_SECRET
   ALIYUN_REGION_ID
   ALIYUN_SIGN_NAME
   ALIYUN_TEMPLATE_CODE
   SERVER_SECRET
   OTP_TTL_SECONDS
   OTP_LENGTH
   OTP_SEND_COOLDOWN_SECONDS
   OTP_DAILY_LIMIT_PER_PHONE
   OTP_VERIFY_MAX_FAILS
   
   ```

1. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Set up MySQL database**
   ```sql
   CREATE DATABASE health;
   use health;
   CREATE TABLE users (
       user_id VARCHAR(36) PRIMARY KEY,
       username CHAR(20) UNIQUE NOT NULL,
       password VARCHAR(64) NOT NULL,
       age INT,
       phone_number VARCHAR(20) UNIQUE
       
   );
   ```

3. **Launch the application**
   ```bash
   # From project root
   chmod 777 launch.sh
   ./launch.sh
   ```

### Development Setup

1. **Frontend Development**
   - Open `index.html` in your browser
   - Use browser dev tools for debugging
   - CSS and JS files are in `statics/` directory

2. **Backend Development**
   - Run Flask in development mode: `python app.py`
   - API endpoints available at `http://localhost:5000`
   - Check logs in `log/` directory

## 🔧 API Endpoints

### Authentication
- `POST /login` - User login
- `POST /register` - User registration

### Health Data
- `POST /readdata` - Retrieve health records
- `POST /editdata` - Update health records

### AI Services
- `POST /deepseek/chat` - General health chat
- `POST /deepseek/structured` - Structured health data extraction

## 🎨 Design System

### Color Scheme
- **Primary**: Material Design blue (#6200ea)
- **Background**: Light/dark theme support
- **Accent**: Consistent color palette throughout

### Typography
- **Font Family**: Roboto (Google Fonts)
- **Icons**: Material Symbols Rounded
- **Accessibility**: Proper contrast ratios and font sizing

### Components
- **Buttons**: Ripple effects and hover states
- **Inputs**: Consistent styling with validation
- **Cards**: Clean, modern card layouts
- **Navigation**: Smooth transitions and indicators

## 🔒 Security Features

- **Password Validation**: 8-20 characters with complexity requirements
- **SQL Injection Prevention**: Parameterized queries
- **CORS Configuration**: Restricted origins for production
- **HTTPS Support**: SSL/TLS encryption ready
- **Input Sanitization**: XSS prevention in AI responses

## 📊 Data Management

### Health Records
- **Diet Tracking**: Food intake and nutritional information
- **Symptom Recording**: Body condition and health observations
- **Date Management**: Chronological health data organization
- **AI Analysis**: Automatic categorization and insights

### User Data
- **Profile Management**: User preferences and settings
- **Data Privacy**: Secure storage and access control
- **Backup Support**: Data export and recovery options

## 🌐 Deployment

### Production Setup
- **SSL Certificate**: Let's Encrypt integration
- **Domain Configuration**: zhucan.xyz domain setup
- **Process Management**: Background service with nohup
- **Logging**: Comprehensive application logging

### Server Requirements
- **OS**: Linux/Unix compatible
- **Python**: 3.7+ runtime
- **Database**: MySQL 5.7+
- **Web Server**: Nginx/Apache (recommended)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the terms specified in the `LICENCE` file.

## 🆘 Support

For support and questions:
- Check the `developer/` directory for additional documentation
- Review the `log/` directory for error information
- Contact the development team

## 🔮 Future Enhancements

- **Mobile App**: Native iOS/Android applications
- **Advanced Analytics**: Health trend analysis and predictions
- **Integration**: Wearable device data synchronization
- **Community Features**: User sharing and support groups
- **Multilingual Support**: Internationalization and localization

---

*Built with ❤️ for better health management*