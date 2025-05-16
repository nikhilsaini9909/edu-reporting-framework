
## Basic Initial Analysis


### Data Structure Thoughts and few understanding..
- Schools -> Classrooms -> Teachers/Students -> Quizzes -> Responses (Real time updates)
- We have school as the top-level entity
- Each school will be having multiple classrooms
- what if a teacher teaches multiple classes?
- we can have another table to map teacher's all classes to whom they are assigned plus the main one.
  - Or maybe just a main_classroom_id and additional_classrooms array!
  - Need to think about how this affects quiz ownership...
- Quizzes for now will be held at classroom-level activities
- Student responses will be tied up with there specific classroom, and quiz.

### Random Questions Popping Up
- What happens if a student transfers between classes mid-semester?
- Do we need to maintain historical data for transferred students?
- Should we allow quiz retakes? If yes, how do we track attempts?
- What about partial submissions? Do we save progress? Current we can have in case of some network issue, unforeseen activity!
- will see what goes while doing dev.

### Few Alternative Approaches I'm Considering

#### Approach 1: Simple but Scalable
- Keep everything in one big database
- Pros: Easy to maintain, straightforward
- Cons: Might hit scaling issues later

#### Approach 2: Event-Driven
- Use event sourcing for quiz submissions
- Store events in a separate table
- Build reports from event stream or may be event_type like this.
- Pros: More flexible, better for analytics
- Cons: More complex, might be overkill

### Random Worries
- What if 1000 students submit quizzes at the same time? A school might be conditing a quiz day, where
    - every class is conditing quizzes, that's a challenge. Need better concurreny in this case..
- Do we need to implement rate limiting?
- Should we cache quiz results?
- Consider this framework for now to be a part of INDIA only, so not considering different timezone challenges..


### Security issues
- What if someone tries to submit answers for another student? or may be someone from another class logged in with the login Id and password of another class student! There will be integrity issues.
- Need to implement proper session management
- Should we add IP tracking for suspicious activities? May be in certain range by picking up latitude or longitude of the school area and restricting access to the app. Or may be restrict access via network that only through school network app will be accessible....


### Some Ideas for Future
- Could add a feature to generate quiz questions using AI
- Need to think about backup strategies
- Add export functionality for reports


# Further implementation and improvements but couldn't finish due to time constraints.
- For the reports simulation we could have used our backend data only and generate reports on that only.
  - due to Supabase free plan limitations i couldn't simulate the teacher and student sessions and the reporting requests.
- For efficiency of retrieval of reports we can add caching layer with redis..
- We can store the session data, offline in case of intermittent connectivity issues.
  - we can queue the request when offline and relay the request to the backend once the connectivity is back.