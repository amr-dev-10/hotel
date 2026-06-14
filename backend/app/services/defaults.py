DEFAULT_DEPARTMENTS = [
    {
        "name": "Front Office",
        "key": "front_office",
        "description": "Reception, manager requests, guest coordination.",
        "keywords": ["manager", "reception", "checkout", "query", "complaint"],
        "resolution_time": "15m",
        "sort_order": 10,
    },
    {
        "name": "Housekeeping",
        "key": "housekeeping",
        "description": "Room amenities, cleaning, towels, pillows, linen.",
        "keywords": ["towel", "cleaning", "pillow", "bedsheet", "water"],
        "resolution_time": "20m",
        "sort_order": 20,
    },
    {
        "name": "Engineering",
        "key": "engineering",
        "description": "AC, TV, plumbing, electrical and maintenance issues.",
        "keywords": ["ac", "tv", "plumbing", "electric", "not working", "repair"],
        "resolution_time": "20m",
        "sort_order": 30,
    },
    {
        "name": "Food And Beverage",
        "key": "food_beverage",
        "description": "Food orders, restaurant offers and in-room dining.",
        "keywords": ["food", "menu", "dinner", "breakfast", "order"],
        "resolution_time": "30m",
        "sort_order": 40,
    },
]

DEFAULT_MAIN_MENU = [
    {"id": "main_food", "title": "Food & Beverages"},
    {"id": "main_room_service", "title": "Room Services"},
    {"id": "main_manager", "title": "Talk to Manager"},
    {"id": "my_requests", "title": "My Requests"},
    {"id": "query_complaint", "title": "Query / Complaint"},
]

DEFAULT_SERVICES = [
    {
        "id": "extra_towels",
        "title": "Extra Towels",
        "department_key": "housekeeping",
        "item": "Extra Towels",
        "priority": 2,
        "keywords": ["towel", "towels"],
    },
    {
        "id": "drinking_water",
        "title": "Drinking Water",
        "department_key": "housekeeping",
        "item": "Drinking Water",
        "priority": 2,
        "keywords": ["water", "bottle", "drinking water"],
    },
    {
        "id": "extra_pillows",
        "title": "Extra Pillows",
        "department_key": "housekeeping",
        "item": "Extra Pillows",
        "priority": 2,
        "keywords": ["pillow", "pillows"],
    },
    {
        "id": "ac_not_working",
        "title": "AC Not Working",
        "department_key": "engineering",
        "item": "AC Not Working",
        "priority": 2,
        "keywords": ["ac", "air conditioner", "cooling", "kharab", "not working"],
    },
    {
        "id": "tv_not_working",
        "title": "TV Not Working",
        "department_key": "engineering",
        "item": "TV Not Working",
        "priority": 2,
        "keywords": ["tv", "television"],
    },
    {
        "id": "plumbing_issue",
        "title": "Plumbing Issue",
        "department_key": "engineering",
        "item": "Plumbing Issue",
        "priority": 3,
        "keywords": ["plumbing", "leak", "tap", "flush", "toilet"],
    },
    {
        "id": "taxi_cab",
        "title": "Taxi/Cab",
        "department_key": "front_office",
        "item": "Taxi/Cab Request",
        "priority": 2,
        "keywords": ["taxi", "cab", "airport", "car"],
    },
]

DEFAULT_BOT_MESSAGES = {
    "welcome_new": "Welcome to {hotel_name}. Please share your name to get started.",
    "ask_room": "Thanks, {guest_name}. What is your room number?",
    "room_not_found": "I could not find room {room_number}. Please check the number or contact reception.",
    "active_welcome": "Welcome, {guest_name}. You are all set.",
    "main_menu": "Hi {guest_name}. How can I help?",
}

DEFAULT_SLA_CONFIG = {
    "front_office": 15,
    "housekeeping": 20,
    "engineering": 20,
    "food_beverage": 30,
    "default": 20,
}
